using GodGram.Data;
using System.Text.Json;
using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace GodGram.Api;

public sealed class ApiError(int status, string reason) : Exception(reason)
{
    public int Status { get; } = status;
}

public static class RequestData
{
    public static async Task<JsonElement> Body(HttpContext ctx)
    {
        try { return await ctx.Request.ReadFromJsonAsync<JsonElement>(); }
        catch(JsonException) { throw new ApiError(400,"Некорректный JSON"); }
    }
    public static string Text(JsonElement data,string key,string fallback="")
    {
        if(data.ValueKind!=JsonValueKind.Object || !data.TryGetProperty(key,out var value)) return fallback;
        if(value.ValueKind==JsonValueKind.String) return value.GetString() ?? "";
        return value.ValueKind is JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False ? value.ToString() : fallback;
    }
    public static long Number(JsonElement data,string key,long fallback=0)
        => long.TryParse(Text(data,key),out var n)?n:fallback;
    public static bool Bool(JsonElement data,string key)
        => Text(data,key).Equals("true",StringComparison.OrdinalIgnoreCase) || Text(data,key)=="1";
    public static IEnumerable<long> Numbers(JsonElement data,string key)
    {
        if(data.ValueKind!=JsonValueKind.Object || !data.TryGetProperty(key,out var a) || a.ValueKind!=JsonValueKind.Array) yield break;
        foreach(var item in a.EnumerateArray()) if(item.ValueKind==JsonValueKind.Number && item.TryGetInt64(out var value)) yield return value;
    }
    public static long QueryLong(HttpContext ctx,string key)
        => long.TryParse(ctx.Request.Query[key].ToString(),out var n)?n:0;
    public static string QueryText(HttpContext ctx,string key)
        => ctx.Request.Query[key].ToString();
    public static string Phone(string input)
    {
        var result = Regex.Replace(input,@"\D","");
        if(result.Length<7 || result.Length>15 || result.StartsWith("888"))
            throw new ApiError(400,"Номер должен содержать 7–15 цифр; +888 — только NFT");
        return result;
    }
    public static void Username(string name)
    {
        if(!Regex.IsMatch(name,@"^[a-z][a-z0-9_]{4,31}$"))
            throw new ApiError(400,"Username: от 5 до 32 символов, a-z, 0-9, _");
    }
    public static string Token(int bytes=32) => Convert.ToHexString(RandomNumberGenerator.GetBytes(bytes)).ToLowerInvariant();
    public static string HashCode(string code) => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(code))).ToLowerInvariant();
    public static double Now() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()/1000.0;
}

public sealed class ChangeFeed
{
    private readonly object _gate = new();
    private long _version=1;
    private TaskCompletionSource<bool> _signal = NewSignal();
    private static TaskCompletionSource<bool> NewSignal() => new(TaskCreationOptions.RunContinuationsAsynchronously);
    public long Version { get {lock(_gate)return _version;} }
    public void Notify()
    {
        lock(_gate) { _version++; _signal.TrySetResult(true); _signal=NewSignal(); }
    }
    public async Task<long> WaitAsync(long seen, CancellationToken ct)
    {
        Task task;
        lock(_gate){ if(seen!=_version)return _version; task=_signal.Task; }
        try{ await task.WaitAsync(TimeSpan.FromSeconds(22),ct); }
        catch(TimeoutException){}
        return Version;
    }
}

public static class Identity
{
    public static async Task<Dictionary<string,object?>> Require(HttpContext ctx,Db db)
    {
        var header = ctx.Request.Headers.Authorization.ToString();
        if(!header.StartsWith("Bearer ",StringComparison.Ordinal))throw new ApiError(401,"Нужен вход");
        var token=header[7..];
        var row = await db.OneAsync(@"SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id
                                    WHERE s.token=@p0 AND NOT u.deleted AND NOT u.frozen",token);
        return row ?? throw new ApiError(401,"Нужен вход");
    }

    public static async Task<object> Public(Db db,Dictionary<string,object?> u,Dictionary<string,object?>? viewer=null)
    {
        bool mine = viewer!=null && (u.Lng("id")==viewer.Lng("id") || viewer.Flag("is_admin"));
        var id=u.Lng("id");
        var handles=new List<object>();
        if(!string.IsNullOrWhiteSpace(u.Str("username")))
            handles.Add(new {handle=u.Str("username"),nft=false,main=true});
        var nftNames=await db.QueryAsync("SELECT handle,price,issued,active FROM nft_usernames WHERE owner_id=@p0 AND active ORDER BY id",id);
        foreach(var n in nftNames)
            handles.Add(new {handle=n.Str("handle"),nft=true,main=false,price=n.Lng("price"),issued=n.Dbl("issued")});
        var badgeRows=await db.QueryAsync(@"SELECT b.* FROM badge_defs b JOIN entity_badges e ON e.bkey=b.key
                                         WHERE e.kind='user' AND e.tid=@p0 ORDER BY b.sort",id);
        var badges=badgeRows.Select(b=>(object)new { key=b.Str("key"),title=b.Str("title"),descr=b.Str("descr"),
            color=b.Str("color"),kind=b.Str("kind"),icon=b.Str("icon") }).ToList();
        if(u.Flag("is_admin")&&!badgeRows.Any(b=>b.Str("key")=="owner"))
            badges.Insert(0,new {key="owner",title="Owner GodGram",descr="Администратор GodGram",color="#111111",kind="verify",icon="</>"});
        var premium=u.Dbl("premium_until")>RequestData.Now();
        var username = u.Str("username");
        return new {
            id, deleted=u.Flag("deleted"),service=u.Flag("is_service"),
            name=u.Str("name"),first_name=u.Str("first_name"),last_name=u.Str("last_name"),
            username=string.IsNullOrWhiteSpace(username)?null:username, usernames=handles,
            nft_username=false,nft_number=!string.IsNullOrEmpty(u.Str("nft_number")),
            phone=mine?u.Str("phone"):u.Str("nft_number"),
            real_phone=mine?u.Str("phone"):"",own_username=mine?username:null,
            avatar_url=string.IsNullOrEmpty(u.Str("avatar"))?"":$"/av/u/{id}?v={u.Lng("avv")}",
            bio=u.Str("bio"),online=RequestData.Now()-u.Dbl("last_seen")<45,
            last_seen=u.Dbl("last_seen"),is_admin=u.Flag("is_admin"),
            is_bot=u.Flag("is_bot"), frozen=u.Flag("frozen"),
            bot_desc=u.Str("bot_desc"),balance=mine?u.Lng("balance"):0,
            rating=u.Lng("rating"),premium,premium_until=premium?u.Dbl("premium_until"):0,
            boost_inf=mine&&u.Flag("boost_inf"),
            emoji_status=premium?u.Str("emoji_status"):"",
            banner=premium&&u.Lng("banner_color")>=0?(object)new {color=u.Lng("banner_color"),pattern=u.Str("banner_pattern")}:null,
            badges,birthday=u.Str("birthday"),address=u.Str("address"),
            work_from=u.Str("work_from"),work_to=u.Str("work_to"),status_text=u.Str("status_text"),
            pchannel=(object?)null,status_nft=(object?)null,
            has_cloud_pw=mine&&!string.IsNullOrEmpty(u.Str("cloud_hash"))
        };
    }
}
