import { useMemo } from 'react';
import type { AppPoint } from '../app/types';
import type { TraceEvent } from '../trace/events';
import { createPointLookup, describeTraceEvent, phaseLabel } from '../trace/describe';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TraceLogProps {
  readonly events: readonly TraceEvent[];
  readonly points: readonly AppPoint[];
  readonly activeEventId: number | null;
}

export function TraceLog({ events, points, activeEventId }: TraceLogProps) {
  const pointLookup = useMemo(() => createPointLookup(points), [points]);

  return (
    <Card size="sm">
      <CardContent>
        <ScrollArea className="h-full">
          {events.length === 0 ? (
            <div className="flex min-h-[12rem] items-center justify-center px-4 text-sm text-muted-foreground">
              Run the algorithm to populate the trace.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {events.map((event) => {
                const active = event.id === activeEventId;

                return (
                  <Card key={event.id} size="sm">
                    <CardContent className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={active ? 'secondary' : 'outline'}>Step {event.id + 1}</Badge>
                        <Badge variant="ghost">{phaseLabel(event.phase)}</Badge>
                      </div>
                      <p className="text-sm text-foreground">{describeTraceEvent(event, pointLookup)}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
