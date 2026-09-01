'use client';

import * as React from 'react';
import { FlaskConical, Rocket, PauseCircle, GitBranch, Target, CalendarClock, Globe2, Beaker } from 'lucide-react';
import { useSession } from '@/components/providers/session-provider';
import { projectService } from '@/lib/mock-services';
import type { ApplicationProject, Locale } from '@/lib/types';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { FadeIn, Stagger, StaggerItem } from '@/components/shared/motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { getLabel, getStageProgress } from '@/lib/labels';
import { formatDate } from '@/lib/formatting';

export default function PortalProjectsPage() {
  const { session, ready } = useSession();
  const companyId = session?.companyId;

  const [projects, setProjects] = React.useState<ApplicationProject[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    projectService.byCompany(companyId).then((prj) => {
      if (cancelled) return;
      setProjects(prj);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const locale: Locale = 'en';

  if (!ready || (companyId && !loaded)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Projects" />
        <EmptyState
          icon={GitBranch}
          title="No company linked to your account"
          description="We couldn't find a company for your portal account. Please contact your Italprotein account manager."
        />
      </div>
    );
  }

  const activeCount = projects.filter(
    (p) => !['launched', 'on_hold'].includes(p.developmentStage),
  ).length;
  const launchedCount = projects.filter((p) => p.developmentStage === 'launched').length;
  const onHoldCount = projects.filter((p) => p.developmentStage === 'on_hold').length;

  const hasNothing = projects.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        subtitle="Your co-development work with Italprotein, from concept through to launch."
      />

      {/* The empty state below stands alone — no row of asserted zeros above it. */}
      {!hasNothing && (
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StaggerItem>
            <StatCard label="Active projects" value={activeCount} icon={FlaskConical} tone="info" hint="In development with our team" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="On hold" value={onHoldCount} icon={PauseCircle} tone="default" hint="Paused for now" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Launched" value={launchedCount} icon={Rocket} tone="success" hint="Live on the market" />
          </StaggerItem>
        </Stagger>
      )}

      {hasNothing ? (
        <EmptyState
          icon={GitBranch}
          title="No projects yet"
          description="When we start a co-development project together, you'll be able to follow its progress here. Reach out to your account manager to get started."
        />
      ) : (
        <FadeIn>
          <Stagger className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {projects.map((project) => (
              <StaggerItem key={project.id}>
                <ProjectCard project={project} locale={locale} />
              </StaggerItem>
            ))}
          </Stagger>
        </FadeIn>
      )}

      <p className="rounded-lg border border-dashed bg-muted/40 p-3 text-center text-xs text-muted-foreground">
        These are shared co-development records. To update a project or add a new one, contact your Italprotein account manager.
      </p>
    </div>
  );
}

function ProjectCard({ project, locale }: { project: ApplicationProject; locale: Locale }) {
  // "On hold" is a state, not a point on the pipeline — the badge already says
  // it, and a half-full bar would invent progress that never happened.
  const onHold = project.developmentStage === 'on_hold';
  const progress = getStageProgress(project.developmentStage);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{project.name}</CardTitle>
          <StatusBadge kind="developmentStage" value={project.developmentStage} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{getLabel('applicationCategory', project.category)}</Badge>
          {project.market && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Globe2 className="h-3.5 w-3.5" /> {project.market}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Development progress</span>
            <span className="font-medium tabular text-foreground">{onHold ? 'Paused' : `${progress}%`}</span>
          </div>
          {!onHold && <Progress value={progress} />}
        </div>

        {project.objective && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Target className="mt-0.5 h-4 w-4 shrink-0 text-brand-teal" />
            <span>{project.objective}</span>
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
          {project.testStage && (
            <span className="inline-flex items-center gap-1">
              <Beaker className="h-3.5 w-3.5" /> {getLabel('testStage', project.testStage)}
            </span>
          )}
          {project.estimatedLaunch && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3.5 w-3.5" /> Est. launch {formatDate(project.estimatedLaunch, locale)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

