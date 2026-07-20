"use client";

import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/EmptyState";
import { Film } from "lucide-react";
import type { MovieAnalyticsEntry } from "@/types/analytics";

interface MovieAnalyticsPanelProps {
  mostWatched: MovieAnalyticsEntry[];
  mostPurchased: MovieAnalyticsEntry[];
}

function MovieRankList({
  entries,
  metric,
}: {
  entries: MovieAnalyticsEntry[];
  metric: (entry: MovieAnalyticsEntry) => { label: string; value: number };
}) {
  const withMovie = entries.filter((e) => e.movie);
  if (!withMovie.length) {
    return (
      <EmptyState icon={Film} title="No data yet" description="Numbers will show up once users start watching." />
    );
  }

  const max = Math.max(...withMovie.map((e) => metric(e).value), 1);

  return (
    <ul className="flex flex-col gap-3">
      {withMovie.map((entry, index) => {
        const movie = entry.movie!;
        const { label, value } = metric(entry);
        return (
          <li key={movie.id} className="flex items-center gap-3">
            <span className="w-4 shrink-0 text-sm font-medium text-muted-foreground">
              {index + 1}
            </span>
            <div className="relative size-11 shrink-0 overflow-hidden rounded-md bg-muted">
              {movie.posterUrl && (
                <Image src={movie.posterUrl} alt={movie.title} fill className="object-cover" sizes="44px" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{movie.title}</p>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
              </div>
              <Progress value={(value / max) * 100} className="mt-1.5 h-1.5" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function MovieAnalyticsPanel({ mostWatched, mostPurchased }: MovieAnalyticsPanelProps) {
  return (
    <Card className="glass-card border-white/[0.08]">
      <CardHeader>
        <CardTitle>Movie Analytics</CardTitle>
        <p className="text-sm text-muted-foreground">Top performing content across the catalog</p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="watched">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="watched">Most Watched</TabsTrigger>
            <TabsTrigger value="purchased">Most Purchased</TabsTrigger>
          </TabsList>
          <TabsContent value="watched">
            <MovieRankList
              entries={mostWatched}
              metric={(e) => ({ label: `${e.viewCount ?? 0} views`, value: e.viewCount ?? 0 })}
            />
          </TabsContent>
          <TabsContent value="purchased">
            <MovieRankList
              entries={mostPurchased}
              metric={(e) => ({ label: `${e.purchaseCount ?? 0} buys`, value: e.purchaseCount ?? 0 })}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
