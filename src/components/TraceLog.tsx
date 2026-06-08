import { useMemo } from 'react';
import type { AppPoint } from '../app/types';
import type { TraceEvent } from '../trace/events';
import { createPointLookup, describeTraceEvent } from '../trace/describe';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { VisualizationMode } from '../app/visualization';

interface TraceLogProps {
  readonly events: readonly TraceEvent[];
  readonly points: readonly AppPoint[];
  readonly activeEventId: number | null;
  readonly pointCount: number;
  readonly stepText: string;
  readonly phase: string;
  readonly mode: VisualizationMode;
  readonly runtimeMs: number | null;
  readonly explanation: string;
  readonly traceSkipped: boolean;
}

export function TraceLog({
  events,
  points,
  activeEventId,
  pointCount,
  stepText,
  phase,
  mode,
  runtimeMs,
  explanation,
  traceSkipped,
}: TraceLogProps) {
  const pointLookup = useMemo(() => createPointLookup(points), [points]);

  return (
    <Card size="sm" className="min-h-0 py-0">
      <CardContent className="grid h-full min-h-0 grid-rows-[auto_1fr] py-3">
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{pointCount} point(s)</Badge>
            <Badge variant="outline">{mode}</Badge>
            <Badge variant="outline">step {stepText}</Badge>
            <Badge variant="outline">{phase}</Badge>
            <Badge variant="outline">runtime {runtimeMs === null ? 'not run' : `${runtimeMs.toFixed(2)} ms`}</Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">{explanation}</p>
          <Separator />
        </div>

        <ScrollArea className="h-full min-h-0">
          {events.length === 0 ? (
            <div className="flex min-h-full items-center justify-center px-4 text-sm text-muted-foreground">
              {traceSkipped ? 'Trace skipped for very large inputs.' : 'Run the algorithm to populate the trace.'}
            </div>
          ) : (
            <div className="flex flex-col">
              {events.map((event) => {
                const active = event.id === activeEventId;

                return (
                  <div key={event.id}>
                    <div className="grid gap-2 py-2 md:grid-cols-[auto_1fr] md:items-start md:gap-3">
                      <div>
                        <Badge variant={active ? 'secondary' : 'outline'}>Step {event.id + 1}</Badge>
                      </div>
                      <p className="text-sm text-foreground">{describeTraceEvent(event, pointLookup)}</p>
                    </div>
                    <Separator />
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
