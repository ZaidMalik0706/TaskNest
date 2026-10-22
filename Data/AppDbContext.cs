using Microsoft.EntityFrameworkCore;
using TaskNest.Models;

namespace TaskNest.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<Subtask> Subtasks => Set<Subtask>();
    public DbSet<FocusSession> FocusSessions => Set<FocusSession>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => u.Email).IsUnique();
        });

        modelBuilder.Entity<TaskItem>(entity =>
        {
            entity.Property(t => t.Title).IsRequired().HasMaxLength(100);
            entity.Property(t => t.Notes).HasMaxLength(2000);
            entity.Property(t => t.Category).HasMaxLength(40);
            // Store the enum as text so the database stays readable.
            entity.Property(t => t.Priority).HasConversion<string>().HasMaxLength(10);

            entity.HasOne<User>()
                .WithMany()
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(t => new { t.UserId, t.IsDone });
            entity.HasIndex(t => new { t.UserId, t.DueDate });
        });

        modelBuilder.Entity<Subtask>(entity =>
        {
            entity.Property(s => s.Title).IsRequired().HasMaxLength(120);

            entity.HasOne(s => s.TaskItem)
                .WithMany(t => t.Subtasks)
                .HasForeignKey(s => s.TaskItemId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<FocusSession>(entity =>
        {
            entity.HasIndex(f => new { f.UserId, f.StartedAt });

            entity.HasOne(f => f.TaskItem)
                .WithMany()
                .HasForeignKey(f => f.TaskItemId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
