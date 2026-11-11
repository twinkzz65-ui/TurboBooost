using GodGram.Data;
using GodGram.Api;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<Db>();
builder.Services.AddSingleton<ChangeFeed>();
// мобильные приложения (APK/IPA) ходят на сервер с другого origin; авторизация через Bearer-токен, не куки
builder.Services.AddCors(o=>o.AddDefaultPolicy(p=>p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));
var app = builder.Build();
app.UseCors();
app.Use(async(ctx,next) =>
{
    try {await next();}
    catch(ApiError ex)
    {
        if(!ctx.Response.HasStarted)
        {
            ctx.Response.StatusCode=ex.Status;
            await ctx.Response.WriteAsJsonAsync(new {error=ex.Message});
        }
    }
    catch(Exception ex)
    {
        app.Logger.LogError(ex,"Unhandled API error");
        if(!ctx.Response.HasStarted)
        {
            ctx.Response.StatusCode=500;
            await ctx.Response.WriteAsJsonAsync(new {error="Ошибка сервера"});
        }
    }
});
app.UseStaticFiles();
app.MapGet("/",()=>Results.Redirect("/app"));
app.MapGet("/app",()=>Results.File(Path.Combine(app.Environment.WebRootPath,"app.html"),"text/html; charset=utf-8"));
app.MapGet("/api/health",()=>Results.Ok(new{ok=true,database="PostgreSQL",backend="ASP.NET Core"}));
AuthRoutes.Map(app);
UserRoutes.Map(app);
ChatRoutes.Map(app);
ExtrasRoutes.Map(app);
app.MapGet("/av/{kind}/{id:long}",async(string kind,long id,Db db)=>
{
    if(kind!="u"&&kind!="c")return Results.NotFound();
    var table=kind=="u"?"users":"chats";
    var r=await db.OneAsync($"SELECT avatar FROM {table} WHERE id=@p0",id);
    if(r is null||!r.Str("avatar").StartsWith("data:image/"))return Results.NotFound();
    var parts=r.Str("avatar").Split(',',2);
    if(parts.Length!=2)return Results.NotFound();
    var mime=parts[0][5..].Split(';')[0];
    if(mime is not ("image/png" or "image/webp" or "image/jpeg" or "image/gif"))return Results.NotFound();
    try {return Results.Bytes(Convert.FromBase64String(parts[1]),mime);}
    catch(FormatException){return Results.NotFound();}
});
await app.Services.GetRequiredService<Db>().InitializeAsync();
app.Logger.LogInformation("GodGram C# listening; PostgreSQL schema initialized. URL: /app");
app.Run();
