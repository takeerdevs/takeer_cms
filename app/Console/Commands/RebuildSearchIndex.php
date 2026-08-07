<?php

namespace App\Console\Commands;

use App\Search\SearchDocumentFactory;
use App\Search\SearchIndexWriter;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\SoftDeletes;

class RebuildSearchIndex extends Command
{
    protected $signature = 'search:reindex {type?} {id?} {--chunk=200}';
    protected $description = 'Rebuild unified search-index entries from authoritative source tables';

    public function handle(SearchDocumentFactory $factory, SearchIndexWriter $writer): int
    {
        $type = $this->argument('type');
        $id = $this->argument('id');
        $types = $type ? [$type] : array_keys(SearchDocumentFactory::TYPES);

        foreach ($types as $currentType) {
            $model = $factory->sourceModel($currentType);
            if (! $model) {
                $this->error("Unknown search type: {$currentType}");
                return self::FAILURE;
            }
            if ($id) {
                $writer->rebuild($currentType, (int) $id);
                continue;
            }
            $query = in_array(SoftDeletes::class, class_uses_recursive($model), true) ? $model::withTrashed() : $model::query();
            $query->select('id')->orderBy('id')->chunkById(max(1, (int) $this->option('chunk')), function ($rows) use ($writer, $currentType): void {
                foreach ($rows as $row) {
                    $writer->rebuild($currentType, (int) $row->id);
                }
            });
            $this->info("Rebuilt {$currentType} entries.");
        }
        return self::SUCCESS;
    }
}
