using GodGram.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace GodGram.Api;

public static class AuthRoutes
{
    private static bool Dev(IConfiguration cfg)=>cfg["GODGRAM_DEV_CODES"]=="1";
    private static string HashPassword(string password,string salt)
        => Convert.ToHexString(Rfc2898DeriveBytes.Pbkdf2(password,Convert.FromHexString(salt),200000,HashAlgorithmName.SHA256,32)).ToLowerInvariant();

    public static void Map(WebApplication app)
    {
        app.MapPost("/api/auth/send_code", async (HttpContext ctx,Db db,IConfiguration cfg,ILogger<Db> log) =>
        {
            // No fictitious SMS delivery: development-only terminal codes.
            if(!Dev(cfg))throw new ApiError(503,"Не настроен SMS-провайдер. Для локального теста установи GODGRAM_DEV_CODES=1");
            var b=await RequestData.Body(ctx);
            var phone=RequestData.Phone(RequestData.Text(b,"phone"));
            var now=RequestData.Now();
            var previous=await db.OneAsync("SELECT sent_at FROM login_codes WHERE phone=@p0",phone);
            if(previous is not null&&now-previous.Dbl("sent_at")<5)throw new ApiError(429,"Повтори через 5 секунд");
            var code=RandomNumberGenerator.GetInt32(0,100000).ToString("D5");
            await db.ExecAsync(@"INSERT INTO login_codes(phone,code_hash,sent_at,expires_at,attempts)
                      VALUES(@p0,@p1,@p2,@p3,0) ON CONFLICT(phone) DO UPDATE SET
                      code_hash=EXCLUDED.code_hash,sent_at=EXCLUDED.sent_at,
                      expires_at=EXCLUDED.expires_at,attempts=0",phone,RequestData.HashCode(code),now,now+300);
            var existing=await db.OneAsync("SELECT id FROM users WHERE phone=@p0 AND NOT deleted",phone);
            log.LogInformation("[DEV LOGIN CODE] +{Phone}: {Code}",phone,code);
            return Results.Ok(new {ok=true,registered=existing is not null,length=5,code});
        });

        app.MapPost("/api/auth/sign_in",async(HttpContext ctx,Db db)=>
        {
            var b=await RequestData.Body(ctx);
            var phone=RequestData.Phone(RequestData.Text(b,"phone"));
            var code=RequestData.Text(b,"code");
            var attempt=await db.OneAsync("SELECT * FROM login_codes WHERE phone=@p0",phone);
            if(attempt is null||attempt.Dbl("expires_at")<RequestData.Now())throw new ApiError(400,"Код истёк");
            if(attempt.Lng("attempts")>=5)throw new ApiError(429,"Слишком много попыток");
            await db.ExecAsync("UPDATE login_codes SET attempts=attempts+1 WHERE phone=@p0",phone);
            if(!CryptographicOperations.FixedTimeEquals(
                 Encoding.UTF8.GetBytes(attempt.Str("code_hash")),Encoding.UTF8.GetBytes(RequestData.HashCode(code))))
                throw new ApiError(400,"Неверный код");
            await db.ExecAsync("DELETE FROM login_codes WHERE phone=@p0",phone);
            var user=await db.OneAsync("SELECT * FROM users WHERE phone=@p0 AND NOT deleted",phone);
            if(user is null)
            {
                var token=RequestData.Token();
                await db.ExecAsync("INSERT INTO registration_tokens(token,phone,expires_at) VALUES(@p0,@p1,@p2)",token,phone,RequestData.Now()+900);
                return Results.Ok(new {registered=false,reg_token=token});
            }
            if(user.Flag("frozen"))throw new ApiError(403,"Аккаунт заморожен");
            if(user.Str("cloud_hash")!="")
            {
                var pending=RequestData.Token();
                await db.ExecAsync("INSERT INTO pending_passwords(token,user_id,expires_at) VALUES(@p0,@p1,@p2)",pending,user.Lng("id"),RequestData.Now()+600);
                return Results.Ok(new {registered=true,need_password=true,pw_token=pending,hint=user.Str("cloud_hint")});
            }
            var session=RequestData.Token();
            await db.ExecAsync("INSERT INTO sessions(token,user_id) VALUES(@p0,@p1)",session,user.Lng("id"));
            return Results.Ok(new {registered=true,token=session});
        });

        app.MapPost("/api/auth/check_password",async(HttpContext ctx,Db db)=>
        {
            var b=await RequestData.Body(ctx);
            var pending=RequestData.Text(b,"pw_token");
            var row=await db.OneAsync(@"SELECT p.*,u.cloud_hash,u.cloud_salt FROM pending_passwords p
                                      JOIN users u ON u.id=p.user_id WHERE p.token=@p0",pending);
            if(row is null||row.Dbl("expires_at")<RequestData.Now())throw new ApiError(400,"Время ввода пароля истекло");
            if(row.Lng("attempts")>=5)throw new ApiError(429,"Слишком много попыток");
            await db.ExecAsync("UPDATE pending_passwords SET attempts=attempts+1 WHERE token=@p0",pending);
            var hash=HashPassword(RequestData.Text(b,"password"),row.Str("cloud_salt"));
            if(!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(hash),Encoding.UTF8.GetBytes(row.Str("cloud_hash"))))
                throw new ApiError(400,"Неверный пароль");
            await db.ExecAsync("DELETE FROM pending_passwords WHERE token=@p0",pending);
            var token=RequestData.Token();
            await db.ExecAsync("INSERT INTO sessions(token,user_id) VALUES(@p0,@p1)",token,row.Lng("user_id"));
            return Results.Ok(new {token});
        });

        app.MapPost("/api/auth/sign_up",async(HttpContext ctx,Db db,IConfiguration cfg,ChangeFeed feed)=>
        {
            var b=await RequestData.Body(ctx);
            var reg=RequestData.Text(b,"reg_token");
            var temp=await db.OneAsync("SELECT * FROM registration_tokens WHERE token=@p0",reg);
            if(temp is null||temp.Dbl("expires_at")<RequestData.Now())throw new ApiError(400,"Регистрация истекла");
            var first=RequestData.Text(b,"first_name").Trim();
            var last=RequestData.Text(b,"last_name").Trim();
            if(first.Length<1||first.Length>40||last.Length>40)throw new ApiError(400,"Проверь имя и фамилию");
            var phone=temp.Str("phone");
            var owner=string.Equals(cfg["GODGRAM_OWNER_PHONE"],phone,StringComparison.Ordinal);
            // Unique constraint prevents duplicate registrations; no public "first user is owner" shortcut.
            var id=Convert.ToInt64(await db.ScalarAsync(@"INSERT INTO users(phone,first_name,last_name,name,is_admin,last_seen)
                        VALUES(@p0,@p1,@p2,@p3,@p4,@p5) RETURNING id",phone,first,last,(first+" "+last).Trim(),owner,RequestData.Now()));
            await db.ExecAsync("DELETE FROM registration_tokens WHERE token=@p0",reg);
            var token=RequestData.Token();
            await db.ExecAsync("INSERT INTO sessions(token,user_id) VALUES(@p0,@p1)",token,id);
            feed.Notify();
            return Results.Ok(new {token});
        });

        app.MapPost("/api/logout",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);
            var token=ctx.Request.Headers.Authorization.ToString()[7..];
            await db.ExecAsync("DELETE FROM sessions WHERE token=@p0 AND user_id=@p1",token,me.Lng("id"));
            return Results.Ok(new {ok=true});
        });
        app.MapPost("/api/sessions/terminate_others",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);
            var token=ctx.Request.Headers.Authorization.ToString()[7..];
            await db.ExecAsync("DELETE FROM sessions WHERE user_id=@p0 AND token<>@p1",me.Lng("id"),token);
            return Results.Ok(new {ok=true});
        });
        app.MapPost("/api/cloud_password",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);
            var b=await RequestData.Body(ctx);
            if(!string.IsNullOrEmpty(me.Str("cloud_hash")))
            {
                var check=HashPassword(RequestData.Text(b,"current"),me.Str("cloud_salt"));
                if(!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(check),Encoding.UTF8.GetBytes(me.Str("cloud_hash"))))
                    throw new ApiError(403,"Неверный текущий пароль");
            }
            var password=RequestData.Text(b,"new");
            if(password.Length==0)
                await db.ExecAsync("UPDATE users SET cloud_hash='',cloud_salt='',cloud_hint='' WHERE id=@p0",me.Lng("id"));
            else
            {
                if(password.Length<8||password.Length>128)throw new ApiError(400,"Пароль: от 8 до 128 символов");
                var salt=RequestData.Token(16);
                await db.ExecAsync("UPDATE users SET cloud_hash=@p0,cloud_salt=@p1,cloud_hint=@p2 WHERE id=@p3",
                    HashPassword(password,salt),salt,RequestData.Text(b,"hint")[..Math.Min(60,RequestData.Text(b,"hint").Length)],me.Lng("id"));
            }
            return Results.Ok(new{ok=true});
        });

        app.MapGet("/api/me",async(HttpContext ctx,Db db,ChangeFeed feed)=>
        {
            var me=await Identity.Require(ctx,db);
            await db.ExecAsync("UPDATE users SET last_seen=@p0 WHERE id=@p1",RequestData.Now(),me.Lng("id"));
            return Results.Ok(new {me=await Identity.Public(db,me,me),v=feed.Version});
        });
        app.MapGet("/api/poll",async(HttpContext ctx,Db db,ChangeFeed feed)=>
        {
            await Identity.Require(ctx,db);
            var v=RequestData.QueryLong(ctx,"v");
            var latest=await feed.WaitAsync(v,ctx.RequestAborted);
            return Results.Ok(new {v=latest});
        });
    }
}
