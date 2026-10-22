using System.ComponentModel.DataAnnotations;

namespace TaskNest.Models;

public enum Priority
{
    Low,
    Medium,
    High
}

public class TaskItem
{
    // The id is created on the client so offline-created tasks keep the same id after syncing.
    public Guid Id { get; set; }

    public int UserId { get; set; }

    [Required]
    [StringLength(100)]
    public string Title { get; set; } = string.Empty;

    [StringLength(2000)]
    public string? Notes { get; set; }

    [EnumDataType(typeof(Priority))]
    public Priority Priority { get; set; } = Priority.Medium;

    [StringLength(40)]
    public string? Category { get; set; }

    public DateTime? DueDate { get; set; }

    public bool IsDone { get; set; }

    public DateTime? CompletedAt { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public List<Subtask> Subtasks { get; set; } = new();
}
