using Microsoft.EntityFrameworkCore;
using TaskNest.Data;
using TaskNest.Models;

namespace TaskNest.Services;

public interface IFocusService
{
    Task<FocusSession?> LogAsync(int userId, Guid taskId, int minutes, DateTime? startedAt);
}

public class FocusService : IFocusService
{
    private readonly AppDbContext _db;

    public FocusService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<FocusSession?> LogAsync(int userId, Guid taskId, int minutes, DateTime? startedAt)
    {
        var ownsTask = await _db.Tasks.AnyAsync(t => t.Id == taskId && t.UserId == userId);
        if (!ownsTask)
        {
            return null;
        }

        var session = new FocusSession
        {
            UserId = userId,
            TaskItemId = taskId,
            Minutes = minutes,
            StartedAt = startedAt ?? DateTime.UtcNow
        };

        _db.FocusSessions.Add(session);
        await _db.SaveChangesAsync();
        return session;
    }
}
