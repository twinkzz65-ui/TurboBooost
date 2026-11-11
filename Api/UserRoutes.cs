using GodGram.Data;
using System.Text.Json;

namespace GodGram.Api;

public static class UserRoutes
{
    private static async Task EnsureUsername(Db db,string un,long uid)
    {
        RequestData.Username(un);
        if((un is "telegram" or "godgram") || (await db.OneAsync(
            "SELECT id FROM users WHERE username=@p0 AND id<>@p1 UNION SELECT id FROM nft_usernames WHERE handle=@p0",un,uid)) is not null)
            throw new ApiError(409,"Это имя занято");
    }
    public static void Map(WebApplication app)
    {
        app.MapGet("/api/users",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);
            var term=RequestData.QueryText(ctx,"q").Trim().TrimStart('@');
            var rows=await db.QueryAsync(@"SELECT * FROM users WHERE NOT deleted AND NOT is_service AND id<>@p0
                       AND (@p1='' OR name ILIKE '%'||@p1||'%' OR username ILIKE '%'||@p1||'%')
                       ORDER BY id DESC LIMIT 50",me.Lng("id"),term);
            var users=new List<object>();
            foreach(var u in rows)users.Add(await Identity.Public(db,u,me));
            return Results.Ok(new {users});
        });
        app.MapGet("/api/user",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);
            var u=await db.OneAsync("SELECT * FROM users WHERE id=@p0",RequestData.QueryLong(ctx,"id"));
            if(u is null)throw new ApiError(404,"Пользователь не найден");
            var publicData=await Identity.Public(db,u,me);
            // Preserve original API shape by merging public profile with collection arrays.
            var data=JsonSerializer.SerializeToElement(publicData,new JsonSerializerOptions{PropertyNamingPolicy=JsonNamingPolicy.CamelCase});
            var result=JsonSerializer.Deserialize<Dictionary<string,object?>>(data.GetRawText())!;
            result["gifts"]=Array.Empty<object>();
            result["nft_gifts"]=Array.Empty<object>();
            return Results.Ok(new {user=result});
        });
        app.MapPost("/api/username/check",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);
            var b=await RequestData.Body(ctx);
            var un=RequestData.Text(b,"username").Trim().TrimStart('@').ToLowerInvariant();
            try {await EnsureUsername(db,un,me.Lng("id"));return Results.Ok(new{ok=true});}
            catch(ApiError ex){return Results.Ok(new{ok=false,error=ex.Message});}
        });
        app.MapPost("/api/profile",async(HttpContext ctx,Db db,ChangeFeed feed)=>
        {
            var me=await Identity.Require(ctx,db);
            var b=await RequestData.Body(ctx);
            var first=RequestData.Text(b,"first_name",me.Str("first_name")).Trim();
            var last=RequestData.Text(b,"last_name",me.Str("last_name")).Trim();
            if(first.Length<1||first.Length>40||last.Length>40)throw new ApiError(400,"Проверь имя");
            var bio=RequestData.Text(b,"bio",me.Str("bio"));
            if(bio.Length>200)bio=bio[..200];
            var un=RequestData.Text(b,"username",me.Str("username")).Trim().TrimStart('@').ToLowerInvariant();
            if(un.Length>0&&un!=me.Str("username"))await EnsureUsername(db,un,me.Lng("id"));
            var avatar=RequestData.Text(b,"avatar",me.Str("avatar"));
            if(avatar.Length>3500000 || (avatar.Length>0&&!avatar.StartsWith("data:image/")))throw new ApiError(400,"Неверный аватар");
            var birthday=RequestData.Text(b,"birthday",me.Str("birthday"));
            if(birthday.Length>0&&!DateOnly.TryParse(birthday,out _))throw new ApiError(400,"Неверная дата");
            await db.ExecAsync(@"UPDATE users SET first_name=@p0,last_name=@p1,name=@p2,
                  bio=@p3,username=@p4,avatar=@p5,avv=avv+1,
                  birthday=@p6,address=@p7,work_from=@p8,work_to=@p9,status_text=@p10
                  WHERE id=@p11",first,last,(first+" "+last).Trim(),bio,
                  string.IsNullOrWhiteSpace(un)?null:un,avatar,birthday,
                  RequestData.Text(b,"address",me.Str("address"))[..Math.Min(120,RequestData.Text(b,"address",me.Str("address")).Length)],
                  RequestData.Text(b,"work_from",me.Str("work_from")),RequestData.Text(b,"work_to",me.Str("work_to")),
                  RequestData.Text(b,"status_text",me.Str("status_text"))[..Math.Min(120,RequestData.Text(b,"status_text",me.Str("status_text")).Length)],
                  me.Lng("id"));
            feed.Notify();
            return Results.Ok(new {ok=true});
        });
        app.MapPost("/api/profile/style",async(HttpContext ctx,Db db,ChangeFeed feed)=>
        {
            var me=await Identity.Require(ctx,db);
            if(me.Dbl("premium_until")<RequestData.Now())throw new ApiError(403,"Нужен GodGram Premium");
            var b=await RequestData.Body(ctx);
            var col=RequestData.Number(b,"banner_color",-1);
            if(col< -1||col>12)throw new ApiError(400,"Неверный цвет");
            var pattern=RequestData.Text(b,"banner_pattern");
            var emoji=RequestData.Text(b,"emoji_status");
            if(pattern.Length>1200000||emoji.Length>700000)throw new ApiError(413,"Слишком большой файл");
            await db.ExecAsync("UPDATE users SET banner_color=@p0,banner_pattern=@p1,emoji_status=@p2 WHERE id=@p3",col,pattern,emoji,me.Lng("id"));
            feed.Notify();
            return Results.Ok(new{ok=true});
        });
        app.MapGet("/api/my_nft",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);
            var uNames=await db.QueryAsync("SELECT * FROM nft_usernames WHERE owner_id=@p0 ORDER BY id",me.Lng("id"));
            var numbers=await db.QueryAsync("SELECT number FROM nft_numbers WHERE owner_id=@p0 ORDER BY id",me.Lng("id"));
            return Results.Ok(new {
                active=uNames.Where(x=>x.Flag("active")).Select(x=>new {handle=x.Str("handle"),nft=true,price=x.Lng("price"),issued=x.Dbl("issued")}),
                inactive=uNames.Where(x=>!x.Flag("active")).Select(x=>x.Str("handle")),
                numbers=numbers.Select(x=>x.Str("number"))
            });
        });
    }
}
