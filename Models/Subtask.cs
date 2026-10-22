using System.ComponentModel.DataAnnotations;

namespace TaskNest.Models;

public class Subtask
{
    public Guid Id { get; set; }

    public Guid TaskItemId { get; set; }

    [Required]
    [StringLength(120)]
    public string Title { get; set; } = string.Empty;

    public bool IsDone { get; set; }

    public TaskItem? TaskItem { get; set; }
}
