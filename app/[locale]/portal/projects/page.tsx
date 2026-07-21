'use client';

import * as React from 'react';
import {
  FlaskConical,
  Rocket,
  Hammer,
  GitBranch,
  Target,
  CalendarClock,
  Package,
  Globe2,
  Beaker,
  Tag,
} from 'lucide-react';
import { useSession } from '@/components/providers/session-provider';
import { projectService, productService } from '@/lib/mock-services';
import type { ApplicationProject, Product, Locale } from '@/lib/types';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import { FadeIn, Stagger, StaggerItem } from '@/components/shared/motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    Promise.all([projectService.byCompany(companyId), productService.byCompany(companyId)]).then(
      ([prj, prd]) => {
        if (cancelled) return;
        setProjects(prj);
        setProducts(prd);
        setLoaded(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const locale: Locale = 'en';

  if (!ready || (companyId && !loaded)) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
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
        <PageHeader title="Projects & products" />
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
  const launchedProducts = products.filter((p) => p.status === 'launched').length;
  const inDevelopment = products.filter((p) => p.status === 'in_development').length;

  const hasNothing = projects.length === 0 && products.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects & products"
        subtitle="Your co-development work with Italprotein, from concept through to launch."
      />

      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StaggerItem>
          <StatCard label="Active projects" value={activeCount} icon={FlaskConical} tone="info" hint="In development with our team" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Products in development" value={inDevelopment} icon={Hammer} tone="gold" hint="Formulations being refined" />
        </StaggerItem>
        <StaggerItem>
          <StatCard label="Launched products" value={launchedProducts} icon={Rocket} tone="success" hint="Live on the market" />
        </StaggerItem>
      </Stagger>

      {hasNothing ? (
        <EmptyState
          icon={GitBranch}
          title="No projects or products yet"
          description="When we start a co-development project together, you'll be able to follow its progress here. Reach out to your account manager to get started."
        />
      ) : (
        <FadeIn>
          <Tabs defaultValue="projects">
            <TabsList>
              <TabsTrigger value="projects">Projects ({projects.length})</TabsTrigger>
              <TabsTrigger value="products">Products ({products.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="projects" className="mt-4">
              {projects.length === 0 ? (
                <EmptyState
                  icon={FlaskConical}
                  title="No active projects"
                  description="There are no development projects on record for your company right now."
                />
              ) : (
                <Stagger className="grid gap-4 md:grid-cols-2">
                  {projects.map((project) => (
                    <StaggerItem key={project.id}>
                      <ProjectCard project={project} locale={locale} />
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </TabsContent>

            <TabsContent value="products" className="mt-4">
              {products.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No products yet"
                  description="Products developed with Proamina will appear here as your projects progress."
                />
              ) : (
                <Stagger className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {products.map((product) => (
                    <StaggerItem key={product.id}>
                      <ProductCard product={product} />
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </TabsContent>
          </Tabs>
        </FadeIn>
      )}

      <p className="rounded-lg border border-dashed bg-muted/40 p-3 text-center text-xs text-muted-foreground">
        These are shared co-development records. To update a project or add a new one, contact your Italprotein account manager.
      </p>
    </div>
  );
}

function ProjectCard({ project, locale }: { project: ApplicationProject; locale: Locale }) {
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
            <span className="font-medium tabular text-foreground">{progress}%</span>
          </div>
          <Progress value={progress} />
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

function ProductCard({ product }: { product: Product }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{product.name}</CardTitle>
          <StatusBadge kind="productStatus" value={product.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{getLabel('applicationCategory', product.category)}</Badge>
          {product.brandName && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Tag className="h-3.5 w-3.5" /> {product.brandName}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2">
        {product.description && (
          <p className="text-sm text-muted-foreground">{product.description}</p>
        )}
        <div className="mt-auto space-y-1 pt-1 text-xs text-muted-foreground">
          {product.market && (
            <p className="inline-flex items-center gap-1">
              <Globe2 className="h-3.5 w-3.5" /> {product.market}
            </p>
          )}
          {product.proaminaDosage && (
            <p className="inline-flex items-center gap-1">
              <Beaker className="h-3.5 w-3.5" /> Proamina dosage: <span className="font-medium text-foreground">{product.proaminaDosage}</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
