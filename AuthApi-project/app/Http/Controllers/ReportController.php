<?php

namespace App\Http\Controllers;

use App\Models\CommentReply;
use App\Models\Post;
use App\Models\Report;
use App\Models\Comments;
use Exception;
use Illuminate\Http\Request;

class ReportController extends BaseController
{
    public function createReport(Request $request)
    {
        $this->validateRequest($request, [
            'reportable_type' => 'required|string|in:post,comment,reply', // Fixed validation syntax
            'reportable_id' => 'required|integer',
            'reason' => 'required|string|max:255',
        ]);

        try {
            $user = auth('api')->user();
            $modelcase = null;

            switch ($request->reportable_type) {
                case 'post':
                    $modelcase = Post::class;
                    break;
                case 'comment':
                    $modelcase = Comments::class; // Fixed Model Name
                    break;
                case 'reply':
                    $modelcase = CommentReply::class;
                    break;
            }

            $reportable = $modelcase::find($request->reportable_id);
            
            if (!$reportable) {
                return $this->Response(false, 'Reportable content not found', null, 404);
            }

            $report = Report::create([
                'user_id' => $user->id,
                'reportable_id' => $reportable->id,
                'reportable_type' => $modelcase,
                'reason' => $request->reason,
            ]);

            return $this->Response(true, 'Report submitted successfully', $report, 201);

        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function getReports(Request $request)
    {
        try {
            $limit = (int) $request->input('limit', 10);
            $user = auth('api')->user();
            if(!$user){
                return $this->unauthorized();
            }
            $reports = Report::limit($limit)->paginate($limit);
            
            $data = $this->paginateData($reports, $reports->items());
            return $this->Response(true, 'Reports retrieved successfully', $data, 200);
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
    public function resolveReport(Request $request)
    {
        $this->validateRequest($request, [
            'report_id' => 'required|integer|exists:reports,id',
            'action' => 'required|string|in:ignore,delete',
        ]);
        try {
            $user = auth('api')->user();
            if (!$user) {
                return $this->unauthorized();
            }
            $report = Report::find($request->report_id);

            if ($request->action === 'ignore') {
                $report->status = 'ignored';
                $report->save();
                return $this->Response(true, 'Report ignored successfully', null, 200);
            }
            if($report->status == 'resolved'){
                return $this->Response(true, 'Report already resolved', null, 200);
            }
            if ($request->action === 'delete') {
                if($report->reportable){
                    $report->reportable->delete();
                }
                $report->status = 'resolved';
                $report->save();
                return $this->Response(true, 'Content deleted and report resolved', null, 200);
            }
        } catch (Exception $e) {
            return $this->Response(false, $e->getMessage(), null, 500);
        }
    }
}
