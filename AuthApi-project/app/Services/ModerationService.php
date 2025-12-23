<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ModerationService
{
    /**
     * Moderate content (Text Only for now as per requirements).
     *
     * @param Model $model The record to flag (Post, Comment).
     * @param string|null $text The text content to check.
     */
    public function moderate(Model $model, ?string $text = null): void
    {
        // 1. Ensure Status is Pending (Wait for Admin or 2-day Auto-Process)
        // Using forceFill to ensure it saves even if status logic in trait is strict
        // 1. Ensure Status is Pending (Wait for Admin or 2-day Auto-Process)
        // Using forceFill to ensure it saves even if status logic in trait is strict
        if (method_exists($model, 'markPending')) {
            $model->markPending();
        } else {
            $model->forceFill(['status' => 0])->save();
        }

        if (empty($text)) {
            return;
        }

        // 2. Check Keywords and Set Flag
        // We do NOT approve/reject here. We only mark "is_flagged"
        // The Scheduled Command will decide fate after 2 days based on this flag.

        $isDirty = $this->checkKeywords($text);

        if ($isDirty) {
            $this->flagContent($model, 'body', 'keyword_violation', "Contains banned keyword.");
        } else {
            // Ensure flag is cleared if clean (in case it was previously flagged)
            $model->forceFill(['is_flagged' => 0])->save();
        }
    }

    /**
     * Check text against banned keywords.
     * @return bool True if dirty, False if clean
     */
    private function checkKeywords(string $text): bool
    {
        $keywords = config('keywords.keywords', []);

        foreach ($keywords as $keyword) {
            if (Str::contains(strtolower($text), strtolower($keyword))) {
                return true;
            }
        }
        return false;
    }

    /**
     * Helper to save flag to database.
     */
    private function flagContent(Model $model, string $field, string $type, ?string $reason): void
    {
        // Update the main model's flag status
        $model->forceFill(['is_flagged' => 1])->save();

        // Create the flag record
        // Verify relationship exists before calling
        if (method_exists($model, 'flaggable')) {
            $model->flaggable()->create([
                'flag_type' => $type,
                'flag_field' => $field,
                'flag_reason' => $reason ?? 'Unknown',
                'created_by' => auth('api')->id() ?? $model->user_id ?? 1,
            ]);
        }

        Log::info("Flagged {$model->getTable()} ID {$model->id}: $reason");
    }
}
