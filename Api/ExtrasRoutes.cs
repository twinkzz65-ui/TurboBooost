using GodGram.Data;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace GodGram.Api;

public static class ExtrasRoutes
{
    private static object Nft(Dictionary<string,object?> r,Dictionary<string,object?>? coll)
    {
        static string[] Parts(string s,int count)
        {
            var p=s.Split('|');
            return p.Length==count?p:Enumerable.Repeat("",count).ToArray();
        }
        var model=Parts(r.Str("model"),3);var bg=Parts(r.Str("backdrop"),4);var sym=Parts(r.Str("symbol"),3);
        static int I(string str)=>int.TryParse(str,out var i)?i:0;
        var name=coll?.Str("name")??"Коллекция";
        return new {id=r.Lng("id"),coll_id=r.Lng("coll_id"),coll=name,
            supply=coll?.Lng("supply")??0,number=r.Lng("number"),glyph=model[1],
            model=new{name=model[0],glyph=model[1],rar=I(model[2])},
            backdrop=new{name=bg[0],c1=bg[1],c2=bg[2],rar=I(bg[3])},
            symbol=new{name=sym[0],glyph=sym[1],rar=I(sym[2])},
            anim=r.Str("anim"),price=r.Lng("price"),listed=r.Flag("listed"),
            owner=(object?)null,ts=r.Dbl("ts"),name=$"{name} #{r.Lng("number")}",nft=true};
    }

    private static async Task<List<object>> Items(Db db,string where,long uid=0)
    {
        // Fixed query fragments only; no user-provided SQL.
        var rows=where switch
        {
            "mine"=>await db.QueryAsync("SELECT * FROM nft_items WHERE owner_id=@p0 ORDER BY id DESC LIMIT 100",uid),
            "listed"=>await db.QueryAsync("SELECT * FROM nft_items WHERE listed ORDER BY price ASC,id DESC LIMIT 120"),
            _=>new List<Dictionary<string,object?>>()
        };
        var colls=await db.QueryAsync("SELECT id,name,supply FROM nft_colls");
        var map=colls.ToDictionary(c=>c.Lng("id"));
        return rows.Select(r=>Nft(r,map.GetValueOrDefault(r.Lng("coll_id")))).ToList();
    }

    public static void Map(WebApplication app)
    {
        app.MapGet("/api/gifts",async(HttpContext ctx,Db db)=>
        {
            await Identity.Require(ctx,db);
            var rows=await db.QueryAsync("SELECT * FROM gifts WHERE active ORDER BY price,id");
            return Results.Ok(new {gifts=rows.Select(r=>new {id=r.Lng("id"),name=r.Str("name"),price=r.Lng("price"),
                model=r.Str("model"),glyph=r.Str("glyph"),color=r.Str("color"),anim=r.Str("anim"),
                supply=r.Lng("supply"),sold=r.Lng("sold")})});
        });
        app.MapGet("/api/nft/mine",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);
            var rows=await db.QueryAsync(@"SELECT ug.*,g.name,g.glyph,g.price,g.color,g.model,g.anim FROM user_gifts ug
                                          JOIN gifts g ON ug.gift_id=g.id WHERE ug.owner_id=@p0 ORDER BY ug.id DESC",me.Lng("id"));
            var gifts=rows.Select(r=>new {id=r.Lng("id"),gift_id=r.Lng("gift_id"),name=r.Str("name"),
                glyph=r.Str("glyph"),color=r.Str("color"),model=r.Str("model"),anim=r.Str("anim"),
                price=r.Lng("price"),listed=r.Flag("listed"),note=r.Str("note"),number=r.Lng("number")});
            return Results.Ok(new {items=await Items(db,"mine",me.Lng("id")),gifts,listed=new Dictionary<string,long>()});
        });
        app.MapPost("/api/nft/wear",async(HttpContext ctx,Db db,ChangeFeed feed)=>
        {
            var me=await Identity.Require(ctx,db);var b=await RequestData.Body(ctx);
            var id=RequestData.Number(b,"id");
            if(id>0 && await db.OneAsync("SELECT 1 FROM nft_items WHERE id=@p0 AND owner_id=@p1",id,me.Lng("id")) is null)
                throw new ApiError(403,"Это не твой предмет");
            await db.ExecAsync("UPDATE users SET status_nft=@p0 WHERE id=@p1",id,me.Lng("id"));
            feed.Notify();return Results.Ok(new{ok=true});
        });
        app.MapGet("/api/market",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);
            var rows=await db.QueryAsync("SELECT * FROM nft_colls WHERE active ORDER BY id");
            var colls=new List<object>();
            foreach(var c in rows)
            {
                var stats=await db.OneAsync("SELECT count(*) AS listed,min(price) AS floor FROM nft_items WHERE coll_id=@p0 AND listed",c.Lng("id"));
                colls.Add(new {id=c.Lng("id"),name=c.Str("name"),glyph=c.Str("glyph"),supply=c.Lng("supply"),
                    minted=c.Lng("minted"),floor=stats?.Lng("floor")??0,listed=stats?.Lng("listed")??0});
            }
            return Results.Ok(new{items=await Items(db,"listed"),gifts=Array.Empty<object>(),colls,balance=me.Lng("balance")});
        });
        app.MapGet("/api/fragment",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);
            var tab=RequestData.QueryText(ctx,"tab");if(tab=="")tab="usernames";
            var q=RequestData.QueryText(ctx,"q").TrimStart('@','+');
            if(tab=="collectibles")return Results.Ok(new {tab,balance=me.Lng("balance"),items=await Items(db,"listed")});
            if(tab=="mine")
            {
                var names=await db.QueryAsync("SELECT * FROM nft_usernames WHERE owner_id=@p0",me.Lng("id"));
                var nums=await db.QueryAsync("SELECT * FROM nft_numbers WHERE owner_id=@p0",me.Lng("id"));
                return Results.Ok(new {tab,balance=me.Lng("balance"),
                    usernames=names.Select(x=>new {id=x.Lng("id"),handle=x.Str("handle"),listed=x.Flag("listed"),price=x.Lng("list_price"),value=x.Lng("price"),kind="username",active=x.Flag("active")}),
                    numbers=nums.Select(x=>new{id=x.Lng("id"),number=x.Str("number"),listed=x.Flag("listed"),price=x.Lng("list_price"),kind="number"}),
                    nfts=await Items(db,"mine",me.Lng("id"))});
            }
            if(tab=="usernames")
            {
                var rows=await db.QueryAsync(@"SELECT * FROM nft_usernames WHERE (listed OR owner_id IS NULL) AND (list_price>0 OR price>0)
                     AND handle ILIKE '%'||@p0||'%' ORDER BY price,id LIMIT 100",q);
                return Results.Ok(new{tab,balance=me.Lng("balance"),items=rows.Select(x=>new{id=x.Lng("id"),handle=x.Str("handle"),
                     price=x.Flag("listed")?x.Lng("list_price"):x.Lng("price"),issued=x.Dbl("issued"),
                     value=x.Lng("price"),kind="username",pool=x["owner_id"] is null,owner=(object?)null})});
            }
            if(tab=="numbers")
            {
                var rows=await db.QueryAsync(@"SELECT * FROM nft_numbers WHERE (listed OR owner_id IS NULL) AND (list_price>0 OR price>0)
                     AND number LIKE '%'||@p0||'%' ORDER BY price,id LIMIT 100",q);
                return Results.Ok(new{tab,balance=me.Lng("balance"),items=rows.Select(x=>new{id=x.Lng("id"),number=x.Str("number"),
                     price=x.Flag("listed")?x.Lng("list_price"):x.Lng("price"),kind="number",pool=x["owner_id"] is null,owner=(object?)null})});
            }
            throw new ApiError(400,"Неизвестная вкладка");
        });
        app.MapGet("/api/wallet",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);
            var rows=await db.QueryAsync("SELECT * FROM tx WHERE user_id=@p0 ORDER BY id DESC LIMIT 50",me.Lng("id"));
            return Results.Ok(new {balance=me.Lng("balance"),tx=rows.Select(x=>new{id=x.Lng("id"),amount=x.Lng("amount"),kind=x.Str("kind"),note=x.Str("note"),ts=x.Dbl("ts")})});
        });
        app.MapGet("/api/checks",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);
            var rows=await db.QueryAsync("SELECT * FROM star_checks WHERE creator_id=@p0 ORDER BY id DESC LIMIT 50",me.Lng("id"));
            return Results.Ok(new {checks=rows.Select(x=>new {id=x.Lng("id"),code=x.Str("code"),amount=x.Lng("amount"),
                max_uses=x.Lng("max_uses"),used=x.Lng("used"),active=x.Flag("active"),note=x.Str("note"),
                created=x.Dbl("created"),expires=x.Dbl("expires"),left=x.Lng("max_uses")-x.Lng("used")}),balance=me.Lng("balance")});
        });
        app.MapGet("/api/badges",async(HttpContext ctx,Db db)=>
        {
            await Identity.Require(ctx,db);
            var rows=await db.QueryAsync("SELECT * FROM badge_defs ORDER BY sort");
            return Results.Ok(new{badges=rows.Select(x=>new{key=x.Str("key"),title=x.Str("title"),descr=x.Str("descr"),
                color=x.Str("color"),kind=x.Str("kind"),icon=x.Str("icon")})});
        });
        app.MapGet("/api/bots",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);
            var rows=await db.QueryAsync("SELECT id,username,name,bot_desc,frozen FROM users WHERE is_bot AND NOT deleted AND bot_owner=@p0",me.Lng("id"));
            return Results.Ok(new {bots=rows.Select(x=>new{id=x.Lng("id"),username=x.Str("username"),name=x.Str("name"),desc=x.Str("bot_desc"),frozen=x.Flag("frozen")})});
        });
        app.MapPost("/api/report",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);var b=await RequestData.Body(ctx);
            var kind=RequestData.Text(b,"kind");
            if(kind is not("user" or "chat" or "channel" or "message"))throw new ApiError(400,"Неверный тип жалобы");
            var reason=RequestData.Text(b,"reason");
            if(reason.Length<1||reason.Length>50)throw new ApiError(400,"Неверная причина");
            await db.ExecAsync("INSERT INTO reports(reporter_id,tkind,tid,reason,text) VALUES(@p0,@p1,@p2,@p3,@p4)",
                me.Lng("id"),kind,RequestData.Number(b,"id"),reason,RequestData.Text(b,"text")[..Math.Min(500,RequestData.Text(b,"text").Length)]);
            return Results.Ok(new{ok=true});
        });
        app.MapGet("/api/stories",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);
            var rows=await db.QueryAsync(@"SELECT s.user_id,count(*) AS count,max(ts) AS last,
                            count(*) FILTER (WHERE v.user_id IS NULL) AS unseen
                       FROM stories s LEFT JOIN story_views v ON v.story_id=s.id AND v.user_id=@p0
                       WHERE s.expires>@p1 GROUP BY s.user_id",me.Lng("id"),RequestData.Now());
            var output=new List<object>();
            foreach(var r in rows)
            {
                var u=await db.OneAsync("SELECT * FROM users WHERE id=@p0 AND NOT deleted",r.Lng("user_id"));
                if(u is null)continue;
                output.Add(new {user=await Identity.Public(db,u,me),count=r.Lng("count"),last=r.Dbl("last"),
                    unseen=r.Lng("user_id")==me.Lng("id")?0:r.Lng("unseen"),mine=r.Lng("user_id")==me.Lng("id")});
            }
            return Results.Ok(new{stories=output});
        });
        app.MapPost("/api/story/create",async(HttpContext ctx,Db db,ChangeFeed feed)=>
        {
            var me=await Identity.Require(ctx,db);var b=await RequestData.Body(ctx);
            var kind=RequestData.Text(b,"kind");
            if(kind!="text")throw new ApiError(501,"Фотографии историй ещё не перенесены в C#");
            var text=RequestData.Text(b,"text").Trim();
            if(text.Length<1||text.Length>300)throw new ApiError(400,"Текст истории: 1–300 символов");
            var now=RequestData.Now();
            await db.ExecAsync("INSERT INTO stories(user_id,kind,text,bg,ts,expires) VALUES(@p0,'text',@p1,@p2,@p3,@p4)",
                  me.Lng("id"),text,Math.Clamp(RequestData.Number(b,"bg"),0,12),now,now+86400);
            feed.Notify();return Results.Ok(new{ok=true});
        });
        app.MapGet("/api/stories/user",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);var id=RequestData.QueryLong(ctx,"id");
            var u=await db.OneAsync("SELECT * FROM users WHERE id=@p0 AND NOT deleted",id)??throw new ApiError(404,"Не найден");
            var rows=await db.QueryAsync("SELECT * FROM stories WHERE user_id=@p0 AND expires>@p1 ORDER BY id",id,RequestData.Now());
            return Results.Ok(new{user=await Identity.Public(db,u,me),stories=rows.Select(s=>new{id=s.Lng("id"),
                   kind=s.Str("kind"),text=s.Str("text"),bg=s.Lng("bg"),ts=s.Dbl("ts"),
                   expires=s.Dbl("expires"),media_url="",viewers=0,viewed=false})});
        });
        app.MapGet("/api/admin/users",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);
            if(!me.Flag("is_admin"))throw new ApiError(403,"Нет прав администратора");
            var rows=await db.QueryAsync("SELECT * FROM users WHERE NOT is_service ORDER BY id DESC LIMIT 200");
            var publicUsers=new List<object>();
            foreach(var u in rows)publicUsers.Add(await Identity.Public(db,u,me));
            return Results.Ok(new {users=publicUsers});
        });
        // Other legacy GodGram operations need a deliberate security-preserving migration.
        // Avoid pretending payments, transfers and NFT sales have succeeded.
        app.MapMethods("/api/{**unported}",["GET","POST","PUT","DELETE"],async(HttpContext ctx,Db db)=>
        {
            await Identity.Require(ctx,db);
            return Results.Json(new{error="Этот API ещё не перенесён с Python на C#",path=ctx.Request.Path.Value},statusCode:501);
        });
    }
}
