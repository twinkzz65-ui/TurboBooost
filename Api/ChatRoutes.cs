using GodGram.Data;
using System.Text.RegularExpressions;

namespace GodGram.Api;

public static class ChatRoutes
{
    private static async Task EnsureMember(Db db,long cid,long uid)
    {
        if(await db.OneAsync("SELECT 1 FROM members WHERE chat_id=@p0 AND user_id=@p1",cid,uid) is null)
            throw new ApiError(403,"Нет доступа к чату");
    }

    public static void Map(WebApplication app)
    {
        app.MapGet("/api/chats",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);var id=me.Lng("id");
            var chats=await db.QueryAsync(@"SELECT c.*,m.last_read, EXISTS(SELECT 1 FROM pins p WHERE p.chat_id=c.id AND p.user_id=@p0) AS pinned
                    FROM chats c JOIN members m ON m.chat_id=c.id AND m.user_id=@p0
                    WHERE NOT c.deleted ORDER BY c.created DESC",id);
            var result=new List<object>();
            foreach(var c in chats)
            {
                var cid=c.Lng("id");
                var last=await db.OneAsync("SELECT m.*,u.name AS sender_name FROM messages m JOIN users u ON m.user_id=u.id WHERE m.chat_id=@p0 ORDER BY m.id DESC LIMIT 1",cid);
                var unread=Convert.ToInt64(await db.ScalarAsync("SELECT count(*) FROM messages WHERE chat_id=@p0 AND id>@p1 AND user_id<>@p2",cid,c.Lng("last_read"),id));
                var kind=c.Str("kind");
                Dictionary<string,object?>? peer=null;
                if(kind=="private")peer=await db.OneAsync(@"SELECT u.* FROM users u JOIN members m ON m.user_id=u.id WHERE m.chat_id=@p0 AND m.user_id<>@p1",cid,id);
                var p=peer is null?null:await Identity.Public(db,peer,me);
                var title=kind=="saved"?"Избранное":kind=="private"?peer?.Str("name")??"Удалённый аккаунт":c.Str("title");
                var avatar=kind=="private"?(peer?.Str("avatar") is {Length:>0}?$"/av/u/{peer.Lng("id")}?v={peer.Lng("avv")}":"")
                    :c.Str("avatar")!=""?$"/av/c/{cid}?v={c.Lng("avv")}":"";
                result.Add(new {
                    id=cid,kind,title,avatar_url=avatar,unread,pinned=c.Flag("pinned"),
                    created=c.Dbl("created"),frozen=c.Flag("frozen"),
                    deleted=c.Flag("deleted"),owner=c.Lng("owner"),
                    handle=c.Str("handle"),members=(object?)null, saved=kind=="saved",
                    can_post=!c.Flag("frozen")&&(kind!="channel"||c.Lng("owner")==id),
                    peer=kind=="saved"?await Identity.Public(db,me,me):p,
                    badges=Array.Empty<object>(),
                    last=last is null?null:(object)new{id=last.Lng("id"),text=last.Str("text"),ts=last.Dbl("ts"),mine=last.Lng("user_id")==id,from=last.Str("sender_name")}
                });
            }
            return Results.Ok(new {chats=result});
        });

        app.MapGet("/api/chat",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);var id=RequestData.QueryLong(ctx,"id");
            await EnsureMember(db,id,me.Lng("id"));
            var chat=await db.OneAsync("SELECT * FROM chats WHERE id=@p0 AND NOT deleted",id)??throw new ApiError(404,"Чат не найден");
            var members=await db.QueryAsync("SELECT u.* FROM users u JOIN members m ON u.id=m.user_id WHERE m.chat_id=@p0",id);
            var publicMembers=new List<object>();
            foreach(var m in members)publicMembers.Add(await Identity.Public(db,m,me));
            return Results.Ok(new {id,kind=chat.Str("kind"),title=chat.Str("title"),owner=chat.Lng("owner"),
                frozen=chat.Flag("frozen"),descr=chat.Str("descr"),handle=chat.Str("handle"),
                level=0,badges=Array.Empty<object>(),members=publicMembers,
                avatar_url=chat.Str("avatar")==""?"":$"/av/c/{id}?v={chat.Lng("avv")}"});
        });

        app.MapPost("/api/chat/private",async(HttpContext ctx,Db db,ChangeFeed feed)=>
        {
            var me=await Identity.Require(ctx,db);var b=await RequestData.Body(ctx);
            var other=RequestData.Number(b,"user_id");var uid=me.Lng("id");
            if(uid==other)throw new ApiError(400,"Нельзя создать чат с самим собой");
            var target=await db.OneAsync("SELECT id FROM users WHERE id=@p0 AND NOT deleted AND NOT is_service",other);
            if(target is null)throw new ApiError(404,"Пользователь не найден");
            var a=Math.Min(uid,other);var c=Math.Max(uid,other);
            // Transaction guarantees both memberships and one canonical private dialog.
            await using var cn=await db.OpenAsync();
            await using var tx=await cn.BeginTransactionAsync();
            await using var mk=Db.Cmd(cn,@"INSERT INTO chats(kind,owner,private_peer) VALUES('private',@p0,@p1)
                            ON CONFLICT(owner,private_peer) WHERE kind='private' DO UPDATE SET deleted=FALSE
                            RETURNING id",[a,c],tx);
            var cid=Convert.ToInt64(await mk.ExecuteScalarAsync());
            foreach(var id in new[]{a,c})
            {
                await using var insert=Db.Cmd(cn,"INSERT INTO members(chat_id,user_id) VALUES(@p0,@p1) ON CONFLICT DO NOTHING",[cid,id],tx);
                await insert.ExecuteNonQueryAsync();
            }
            await tx.CommitAsync();feed.Notify();
            return Results.Ok(new{chat_id=cid});
        });

        app.MapPost("/api/chat/group",async(HttpContext ctx,Db db,ChangeFeed feed)=>
        {
            var me=await Identity.Require(ctx,db);var b=await RequestData.Body(ctx);
            var title=RequestData.Text(b,"title").Trim();
            if(title.Length<1||title.Length>50)throw new ApiError(400,"Проверь название группы");
            var avatar=RequestData.Text(b,"avatar");
            if(avatar.Length>3500000)throw new ApiError(413,"Аватар слишком большой");
            var ids=RequestData.Numbers(b,"members").Take(200).Append(me.Lng("id")).Distinct().ToArray();
            await using var cn=await db.OpenAsync();
            await using var tx=await cn.BeginTransactionAsync();
            await using var cmd=Db.Cmd(cn,@"INSERT INTO chats(kind,title,owner,avatar,avv)
                          VALUES('group',@p0,@p1,@p2,1) RETURNING id",[title,me.Lng("id"),avatar],tx);
            var cid=Convert.ToInt64(await cmd.ExecuteScalarAsync());
            foreach(var id in ids)
            {
                await using var ins=Db.Cmd(cn,@"INSERT INTO members(chat_id,user_id)
                                  SELECT @p0,id FROM users WHERE id=@p1 AND NOT deleted
                                  ON CONFLICT DO NOTHING",[cid,id],tx);
                await ins.ExecuteNonQueryAsync();
            }
            await tx.CommitAsync();feed.Notify();
            return Results.Ok(new {chat_id=cid});
        });

        app.MapGet("/api/messages",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);var uid=me.Lng("id");var cid=RequestData.QueryLong(ctx,"chat_id");
            await EnsureMember(db,cid,uid);
            var messages=(await db.QueryAsync(@"SELECT m.*,u.name AS sender_name,u.avatar AS sender_avatar,u.avv AS sender_avv,
                    u.is_bot AS sender_bot,u.deleted AS sender_deleted FROM messages m
                    JOIN users u ON u.id=m.user_id WHERE m.chat_id=@p0
                    ORDER BY m.id DESC LIMIT 200",cid)).AsEnumerable().Reverse().ToList();
            if(RequestData.QueryText(ctx,"read").Length>0&&messages.Count>0)
                await db.ExecAsync("UPDATE members SET last_read=@p0 WHERE chat_id=@p1 AND user_id=@p2",messages[^1].Lng("id"),cid,uid);
            var chat=await db.OneAsync("SELECT kind FROM chats WHERE id=@p0",cid);
            long peerRead=0;
            if(chat?.Str("kind")=="private")
            {
                var other=await db.OneAsync("SELECT last_read FROM members WHERE chat_id=@p0 AND user_id<>@p1",cid,uid);
                peerRead=other?.Lng("last_read")??0;
            }
            return Results.Ok(new {
                messages=messages.Select(m=>new {
                    id=m.Lng("id"),uid=m.Lng("user_id"),text=m.Str("text"),ts=m.Dbl("ts"),
                    gift=(object?)null,media_url=m.Str("media_key")!=""?"/media/"+m.Str("media_key"):"",
                    media_kind=m.Str("media_kind"),media_dur=m.Lng("media_dur"),
                    sender=new {id=m.Lng("user_id"),name=m.Str("sender_name"),
                        avatar_url=m.Str("sender_avatar")!=""?$"/av/u/{m.Lng("user_id")}?v={m.Lng("sender_avv")}":"",
                        deleted=m.Flag("sender_deleted"),service=false,premium=false,emoji_status="",
                        bot=m.Flag("sender_bot"),badges=Array.Empty<object>(),status_nft=(object?)null}
                }),peer_last_read=peerRead
            });
        });

        app.MapPost("/api/send",async(HttpContext ctx,Db db,ChangeFeed feed)=>
        {
            var me=await Identity.Require(ctx,db);var b=await RequestData.Body(ctx);
            var cid=RequestData.Number(b,"chat_id");var uid=me.Lng("id");
            var text=RequestData.Text(b,"text").Trim();
            if(text.Length==0||text.Length>4000)throw new ApiError(400,"Длина сообщения: 1–4000 символов");
            await EnsureMember(db,cid,uid);
            var chat=await db.OneAsync("SELECT * FROM chats WHERE id=@p0 AND NOT deleted",cid)??throw new ApiError(404,"Чат не найден");
            if(chat.Flag("frozen")||(chat.Str("kind")=="channel"&&chat.Lng("owner")!=uid))
                throw new ApiError(403,"Нет прав на отправку сообщения");
            if(chat.Str("kind")=="private")
            {
                var other=await db.OneAsync(@"SELECT u.deleted,u.frozen,u.is_service FROM users u
                        JOIN members m ON m.user_id=u.id WHERE m.chat_id=@p0 AND m.user_id<>@p1",cid,uid);
                if(other is null||other.Flag("deleted")||other.Flag("frozen")||other.Flag("is_service"))
                    throw new ApiError(403,"Сообщение отправить нельзя");
            }
            var msgId=Convert.ToInt64(await db.ScalarAsync(@"INSERT INTO messages(chat_id,user_id,text)
                         VALUES(@p0,@p1,@p2) RETURNING id",cid,uid,text));
            await db.ExecAsync("UPDATE members SET last_read=@p0 WHERE chat_id=@p1 AND user_id=@p2",msgId,cid,uid);
            feed.Notify();return Results.Ok(new{ok=true,id=msgId});
        });

        app.MapPost("/api/saved",async(HttpContext ctx,Db db,ChangeFeed feed)=>
        {
            var me=await Identity.Require(ctx,db);var uid=me.Lng("id");
            var cid=Convert.ToInt64(await db.ScalarAsync(@"INSERT INTO chats(kind,title,owner)
                       VALUES('saved','Избранное',@p0)
                       ON CONFLICT(owner) WHERE kind='saved' DO UPDATE SET deleted=FALSE
                       RETURNING id",uid));
            await db.ExecAsync("INSERT INTO members(chat_id,user_id) VALUES(@p0,@p1) ON CONFLICT DO NOTHING",cid,uid);
            feed.Notify();return Results.Ok(new{chat_id=cid});
        });

        app.MapPost("/api/chat/channel",async(HttpContext ctx,Db db,ChangeFeed feed)=>
        {
            var me=await Identity.Require(ctx,db);var b=await RequestData.Body(ctx);
            var title=RequestData.Text(b,"title").Trim();
            if(title.Length<1||title.Length>50)throw new ApiError(400,"Проверь название канала");
            var handle=RequestData.Text(b,"handle").Trim().TrimStart('@').ToLowerInvariant();
            if(handle!="")RequestData.Username(handle);
            var id=me.Lng("id");
            var cid=Convert.ToInt64(await db.ScalarAsync(@"INSERT INTO chats(kind,title,owner,handle,descr,pub)
                      VALUES('channel',@p0,@p1,@p2,@p3,@p4) RETURNING id",
                      title,id,handle==""?null:handle,RequestData.Text(b,"descr"),!RequestData.Bool(b,"private")));
            await db.ExecAsync("INSERT INTO members(chat_id,user_id) VALUES(@p0,@p1)",cid,id);
            feed.Notify();return Results.Ok(new{chat_id=cid});
        });
        app.MapGet("/api/channels",async(HttpContext ctx,Db db)=>
        {
            var me=await Identity.Require(ctx,db);
            var term=RequestData.QueryText(ctx,"q").Trim();
            var rows=await db.QueryAsync(@"SELECT c.* FROM chats c WHERE c.kind='channel' AND NOT c.deleted
                    AND (c.pub OR c.owner=@p0 OR EXISTS(SELECT 1 FROM members m WHERE m.chat_id=c.id AND m.user_id=@p0))
                    AND (@p1='' OR c.title ILIKE '%'||@p1||'%' OR c.handle ILIKE '%'||@p1||'%')
                    ORDER BY c.created DESC LIMIT 30",me.Lng("id"),term);
            var list=new List<object>();
            foreach(var c in rows)
            {
                var members=Convert.ToInt64(await db.ScalarAsync("SELECT count(*) FROM members WHERE chat_id=@p0",c.Lng("id")));
                list.Add(new {id=c.Lng("id"),kind="channel",title=c.Str("title"),members,handle=c.Str("handle"),
                    descr=c.Str("descr"),owner=c.Lng("owner"),pub=c.Flag("pub"),level=0,
                    joined=await db.OneAsync("SELECT 1 FROM members WHERE chat_id=@p0 AND user_id=@p1",c.Lng("id"),me.Lng("id")) is not null,
                    boosts=0,badges=Array.Empty<object>(),frozen=c.Flag("frozen"),
                    avatar_url=c.Str("avatar")!=""?$"/av/c/{c.Lng("id")}?v={c.Lng("avv")}":""});
            }
            return Results.Ok(new{channels=list});
        });
        app.MapPost("/api/channel/join",async(HttpContext ctx,Db db,ChangeFeed feed)=>
        {
            var me=await Identity.Require(ctx,db);var b=await RequestData.Body(ctx);
            var cid=RequestData.Number(b,"chat_id");
            if(cid==0)
            {
                var c0=await db.OneAsync("SELECT id FROM chats WHERE handle=@p0",RequestData.Text(b,"handle").TrimStart('@'));
                cid=c0?.Lng("id")??0;
            }
            var c=await db.OneAsync("SELECT * FROM chats WHERE id=@p0 AND kind='channel' AND NOT deleted",cid)
                ??throw new ApiError(404,"Канал не найден");
            if(!c.Flag("pub")&&c.Lng("owner")!=me.Lng("id"))throw new ApiError(403,"Приватный канал: требуется приглашение");
            await db.ExecAsync("INSERT INTO members(chat_id,user_id) VALUES(@p0,@p1) ON CONFLICT DO NOTHING",cid,me.Lng("id"));
            feed.Notify();return Results.Ok(new{ok=true,chat_id=cid});
        });
        app.MapPost("/api/channel/leave",async(HttpContext ctx,Db db,ChangeFeed feed)=>
        {
            var me=await Identity.Require(ctx,db);var b=await RequestData.Body(ctx);
            var cid=RequestData.Number(b,"chat_id");
            var c=await db.OneAsync("SELECT owner FROM chats WHERE id=@p0",cid);
            if(c?.Lng("owner")==me.Lng("id"))throw new ApiError(403,"Владелец не может покинуть свой канал");
            await db.ExecAsync("DELETE FROM members WHERE chat_id=@p0 AND user_id=@p1",cid,me.Lng("id"));
            feed.Notify();return Results.Ok(new{ok=true});
        });
        app.MapPost("/api/pin",async(HttpContext ctx,Db db,ChangeFeed feed)=>
        {
            var me=await Identity.Require(ctx,db);var b=await RequestData.Body(ctx);
            var cid=RequestData.Number(b,"chat_id");
            await EnsureMember(db,cid,me.Lng("id"));
            if(RequestData.Bool(b,"on"))
                await db.ExecAsync("INSERT INTO pins(user_id,chat_id) VALUES(@p0,@p1) ON CONFLICT DO NOTHING",me.Lng("id"),cid);
            else await db.ExecAsync("DELETE FROM pins WHERE user_id=@p0 AND chat_id=@p1",me.Lng("id"),cid);
            feed.Notify();return Results.Ok(new{ok=true});
        });
    }
}
