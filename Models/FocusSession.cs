using System.ComponentModel.DataAnnotations;

namespace TaskNest.Models;

public class FocusSession
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public Guid? TaskItemId { get; set; }

    [Range(1, 600)]
    public int Minutes { get; set; }

    public DateTime StartedAt { get; set; }

    public TaskItem? TaskItem { get; set; }
}
