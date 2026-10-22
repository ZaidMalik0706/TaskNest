using Microsoft.EntityFrameworkCore;
using TaskNest.Data;
using TaskNest.Dtos;

namespace TaskNest.Services;

public interface IStatsService
{
    Task<StatsResponse> GetStatsAsync(int userId);
}

public class StatsService : IStatsService
{
    private readonly AppDbContext _db;

    public StatsService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<StatsResponse> GetStatsAsync(int userId)
    {
        var today = DateTime.UtcNow.Date;

        // Completed tasks in the seven-day window that ends today.
        var windowStart = today.AddDays(-6);
        var recentCompletionTimes = await _db.Tasks
            .AsNoTracking()
            .Where(t => t.UserId == userId && t.IsDone && t.CompletedAt != null && t.CompletedAt >= windowStart)
            .Select(t => t.CompletedAt!.Value)
            .ToListAsync();

        var recentDates = recentCompletionTimes.Select(d => d.Date).ToList();
        var completedByDay = Enumerable.Range(0, 7)
            .Select(offset =>
            {
                var date = windowStart.AddDays(offset);
                return new DailyCount
                {
                    Date = date.ToString("yyyy-MM-dd"),
                    Count = recentDates.Count(d => d == date)
                };
            })
            .ToList();

        // Streak: walk backwards day by day. If today has no completions yet,
        // the streak can still continue from yesterday.
        var allCompletionTimes = await _db.Tasks
            .AsNoTracking()
            .Where(t => t.UserId == userId && t.IsDone && t.CompletedAt != null)
            .Select(t => t.CompletedAt!.Value)
            .ToListAsync();

        var completionDays = allCompletionTimes.Select(d => d.Date).ToHashSet();
        var cursor = today;
        if (!completionDays.Contains(cursor))
        {
            cursor = cursor.AddDays(-1);
        }

        var streak = 0;
        while (completionDays.Contains(cursor))
        {
            streak++;
            cursor = cursor.AddDays(-1);
        }

        // Week starts on Monday.
        var daysSinceMonday = ((int)today.DayOfWeek + 6) % 7;
        var weekStart = today.AddDays(-daysSinceMonday);
        var focusMinutes = await _db.FocusSessions
            .Where(f => f.UserId == userId && f.StartedAt >= weekStart)
            .SumAsync(f => (int?)f.Minutes) ?? 0;

        var overdueCount = await _db.Tasks
            .CountAsync(t => t.UserId == userId && !t.IsDone && t.DueDate != null && t.DueDate.Value.Date < today);

        return new StatsResponse
        {
            CompletedLast7Days = completedByDay,
            CurrentStreak = streak,
            FocusMinutesThisWeek = focusMinutes,
            OverdueCount = overdueCount
        };
    }
}
