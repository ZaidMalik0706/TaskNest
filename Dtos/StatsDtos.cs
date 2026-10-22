namespace TaskNest.Dtos;

public class DailyCount
{
    public string Date { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class StatsResponse
{
    public List<DailyCount> CompletedLast7Days { get; set; } = new();
    public int CurrentStreak { get; set; }
    public int FocusMinutesThisWeek { get; set; }
    public int OverdueCount { get; set; }
}
