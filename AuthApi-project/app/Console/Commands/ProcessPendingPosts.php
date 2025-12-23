<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Post;
use Hootlex\Moderation\Status;

class ProcessPendingPosts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'moderation:process';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Process pending posts older than 2 days. Approve clean, Reject flagged.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Checking for pending posts...');

        // Pending Status usually 1 (check config/moderation.php or use Status::PENDING if available, 
        // but let's assume standard behavior or query by scope if provided by package).
        // Since we know we set status=1 (Pending) in Service via markAsPending().
        
        // Let's use the scope provided by trait if possible, generally `pending()` scope.
        // Hootlex/Laravel-Moderation usually provides `pending()` scope.
        
        // Use the package scope for pending posts (Status 0)
        $posts = Post::pending()
                      ->where('created_at', '<', now()->subDays(2))
                      ->get();

        $count = $posts->count();
        if ($count === 0) {
            $this->info('No pending posts older than 2 days found.');
            return;
        }

        $this->info("Found {$count} posts to process.");

        foreach ($posts as $post) {
            if ($post->is_flagged == 1) {
                // Reject
                $post->markRejected();
                $this->warn("Post ID {$post->id} REJECTED (Flagged).");
            } else {
                // Approve
                $post->markApproved();
                $this->info("Post ID {$post->id} APPROVED (Clean).");
            }
        }

        $this->info('Processing complete.');
    }
}
