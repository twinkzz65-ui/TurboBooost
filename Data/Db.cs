using Npgsql;
using System.Data;

namespace GodGram.Data;

public sealed class Db
{
    private readonly string _connection;
    public Db(IConfiguration cfg)
    {
        _connection = cfg["GODGRAM_DB"]
            ?? "Host=localhost;Port=5432;Database=godgram;Username=godgram;Password=devpassword_change_me";
    }

    public async Task<NpgsqlConnection> OpenAsync()
    {
        var cn = new NpgsqlConnection(_connection);
        await cn.OpenAsync();
        return cn;
    }

    public async Task InitializeAsync()
    {
        var sql = await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory,"Database","schema.sql"));
        await using var cn = await OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, cn) { CommandTimeout = 45 };
        await cmd.ExecuteNonQueryAsync();
    }

    public static NpgsqlCommand Cmd(NpgsqlConnection cn, string sql, object?[] args, NpgsqlTransaction? tx = null)
    {
        var cmd = new NpgsqlCommand(sql,cn,tx);
        for (int i=0;i<args.Length;i++) cmd.Parameters.AddWithValue($"p{i}", args[i] ?? DBNull.Value);
        return cmd;
    }

    public async Task<List<Dictionary<string,object?>>> QueryAsync(string sql, params object?[] args)
    {
        await using var cn = await OpenAsync();
        await using var cmd = Cmd(cn,sql,args);
        await using var r = await cmd.ExecuteReaderAsync();
        var rows = new List<Dictionary<string,object?>>();
        while (await r.ReadAsync())
        {
            var row = new Dictionary<string,object?>(StringComparer.OrdinalIgnoreCase);
            for(var i=0;i<r.FieldCount;i++) row[r.GetName(i)] = r.IsDBNull(i) ? null : r.GetValue(i);
            rows.Add(row);
        }
        return rows;
    }

    public async Task<Dictionary<string,object?>?> OneAsync(string sql, params object?[] args)
      => (await QueryAsync(sql,args)).FirstOrDefault();

    public async Task<object?> ScalarAsync(string sql,params object?[] args)
    {
        await using var cn = await OpenAsync();
        await using var cmd = Cmd(cn,sql,args);
        return await cmd.ExecuteScalarAsync();
    }

    public async Task<int> ExecAsync(string sql,params object?[] args)
    {
        await using var cn = await OpenAsync();
        await using var cmd = Cmd(cn,sql,args);
        return await cmd.ExecuteNonQueryAsync();
    }
}

public static class RowExt
{
    public static string Str(this Dictionary<string,object?> row,string key)
        => row.TryGetValue(key,out var v)&&v!=null ? Convert.ToString(v) ?? "" : "";
    public static long Lng(this Dictionary<string,object?> row,string key)
        => row.TryGetValue(key,out var v)&&v!=null ? Convert.ToInt64(v) : 0;
    public static double Dbl(this Dictionary<string,object?> row,string key)
        => row.TryGetValue(key,out var v)&&v!=null ? Convert.ToDouble(v) : 0;
    public static bool Flag(this Dictionary<string,object?> row,string key)
        => row.TryGetValue(key,out var v)&&v!=null && Convert.ToBoolean(v);
}
