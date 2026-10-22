using System.ComponentModel.DataAnnotations;

namespace TaskNest.Dtos;

public class FocusRequest
{
    [Required]
    public Guid TaskId { get; set; }

    [Range(1, 600)]
    public int Minutes { get; set; }

    public DateTime? StartedAt { get; set; }
}
