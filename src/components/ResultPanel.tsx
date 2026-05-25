import type { AlgorithmResult } from '../app/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface ResultPanelProps {
  readonly result: AlgorithmResult;
}

export function ResultPanel({ result }: ResultPanelProps) {
  return (
    <Card size="sm" className="min-h-0 py-0">
      <CardContent className="h-full min-h-0 py-3">
        <ScrollArea className="h-full">
          <div className="flex flex-col">
            {result.nearestNeighbors.map((item) => {
              const source = result.points[item.point];
              const neighbors = item.neighbors
                .map((neighbor) => result.points[neighbor])
                .filter((neighbor): neighbor is AlgorithmResult['points'][number] => Boolean(neighbor));

              return (
                <div key={source?.id ?? item.point}>
                  <div className="grid gap-2 py-2 md:grid-cols-[minmax(0,120px)_1fr_auto] md:items-center">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{source?.name ?? `#${item.point}`}</Badge>
                      {source?.sortedIndex !== null && source?.sortedIndex !== undefined ? (
                        <Badge variant="outline">P{source.sortedIndex + 1}</Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {neighbors.map((neighbor) => {
                        const sortedLabel = neighbor.sortedIndex === null ? null : `P${neighbor.sortedIndex + 1}`;
                        return sortedLabel ? `${neighbor.name} [${sortedLabel}]` : neighbor.name;
                      }).join(', ')}
                    </p>
                    <Badge variant="outline">d² = {item.distanceSquared.toFixed(2)}</Badge>
                  </div>
                  <Separator />
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
