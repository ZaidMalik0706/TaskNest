using System.ComponentModel.DataAnnotations;
using TaskNest.Models;

namespace TaskNest.Dtos;

public class TaskUpsertRequest
{
    // Client-generated id: required for offline-first syncing.
    public Guid Id { get; set; }

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
}

public class SubtaskRequest
{
    public Guid? Id { get; set; }

    [Required]
    [StringLength(120)]
    public string Title { get; set; } = string.Empty;
}

public class SubtaskUpdateRequest
{
    [StringLength(120)]
    public string? Title { get; set; }

    public bool? IsDone { get; set; }
}

public class SubtaskDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public bool IsDone { get; set; }

    public static SubtaskDto FromEntity(Subtask subtask) => new()
    {
        Id = subtask.Id,
        Title = subtask.Title,
        IsDone = subtask.IsDone
    };
}

public class TaskResponse
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public Priority Priority { get; set; }
    public string? Category { get; set; }
    public DateTime? DueDate { get; set; }
    public bool IsDone { get; set; }
    public DateTime? CompletedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<SubtaskDto> Subtasks { get; set; } = new();

    public static TaskResponse FromEntity(TaskItem task) => new()
    {
        Id = task.Id,
        Title = task.Title,
        Notes = task.Notes,
        Priority = task.Priority,
        Category = task.Category,
        DueDate = task.DueDate,
        IsDone = task.IsDone,
        CompletedAt = task.CompletedAt,
        CreatedAt = task.CreatedAt,
        UpdatedAt = task.UpdatedAt,
        Subtasks = task.Subtasks.Select(SubtaskDto.FromEntity).ToList()
    };
}
