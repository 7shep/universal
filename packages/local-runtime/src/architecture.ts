import path from 'node:path';
import ts from 'typescript';
import type { GeneratedProject, ProjectGenerationRequest } from '@universal/generation';

export type ArchitectureSeverity = 'error' | 'warning';

export interface ArchitectureFinding {
  id:
    | 'ARCH_APP_MONOLITH'
    | 'ARCH_PAGE_MODULES_REQUIRED'
    | 'ARCH_ROUTE_PAGE_COVERAGE'
    | 'ARCH_SHARED_REGION_EXTRACTION'
    | 'ARCH_APP_MULTIPLE_PAGES'
    | 'ARCH_TYPED_PROPS'
    | 'ARCH_DUPLICATED_JSX'
    | 'ARCH_INLINE_DATA'
    | 'ARCH_STYLESHEET_ORGANIZATION'
    | 'ARCH_MODULE_RESPONSIBILITY'
    | 'ARCH_APP_COMPLEXITY';
  severity: ArchitectureSeverity;
  message: string;
  evidence: Readonly<Record<string, unknown>>;
}

export interface ArchitectureEvidence {
  readonly [key: string]: unknown;
  complexity: 'small' | 'substantial-single-page' | 'multi-route';
  largestModule: { path: string; jsxElements: number; components: number };
  largestComponent: { path: string; name: string; jsxElements: number } | null;
  app: { jsxElements: number; maxJsxDepth: number; fullPageComponents: number };
  pageModules: readonly string[];
  routeMappings: Readonly<Record<string, string | null>>;
  sharedComponents: readonly string[];
  props: { typed: readonly string[]; untyped: readonly string[] };
  duplicatedSubtrees: readonly { fingerprint: string; occurrences: readonly string[] }[];
  inlineData: readonly { path: string; entries: number; line: number }[];
  stylesheets: readonly { path: string; characters: number; rules: number }[];
}

export interface ArchitectureAnalysis {
  findings: readonly ArchitectureFinding[];
  evidence: ArchitectureEvidence;
}

interface ComponentInfo {
  name: string;
  path: string;
  jsxElements: number;
  maxJsxDepth: number;
  semanticTags: Set<string>;
  typedProps: boolean;
  acceptsProps: boolean;
  exported: boolean;
  node: ts.Node;
}

interface ModuleInfo {
  path: string;
  source: ts.SourceFile;
  components: ComponentInfo[];
  imports: Map<string, string>;
  jsxUsages: Set<string>;
  inlineData: { entries: number; line: number }[];
}

const reactExtensions = ['.tsx', '.ts'];
const interfaceRegionAliases: Readonly<Record<string, readonly string[]>> = {
  navigation: ['navigation', 'nav', 'header', 'masthead'],
  header: ['header', 'masthead', 'navigation', 'nav'],
  masthead: ['masthead', 'header', 'navigation', 'nav'],
  footer: ['footer']
};

function normalizeFilePath(value: string): string {
  return value.replaceAll('\\', '/');
}

function resolveImport(from: string, specifier: string, paths: ReadonlySet<string>): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = normalizeFilePath(
    path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier))
  );
  for (const candidate of [
    base,
    ...reactExtensions.map((extension) => `${base}${extension}`),
    ...reactExtensions.map((extension) => `${base}/index${extension}`)
  ])
    if (paths.has(candidate)) return candidate;
  return null;
}

function componentNameFromTag(tagName: ts.JsxTagNameExpression): string {
  return tagName.getText().split('.')[0] ?? tagName.getText();
}

function jsxMetrics(node: ts.Node): {
  count: number;
  maxDepth: number;
  semanticTags: Set<string>;
} {
  let count = 0,
    maxDepth = 0;
  const semanticTags = new Set<string>();
  const visit = (current: ts.Node, depth: number) => {
    const isElement =
      ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current) || ts.isJsxFragment(current);
    const nextDepth = isElement ? depth + 1 : depth;
    if (isElement) {
      count += 1;
      maxDepth = Math.max(maxDepth, nextDepth);
      if (ts.isJsxElement(current))
        semanticTags.add(current.openingElement.tagName.getText().toLowerCase());
      if (ts.isJsxSelfClosingElement(current))
        semanticTags.add(current.tagName.getText().toLowerCase());
    }
    ts.forEachChild(current, (child) => visit(child, nextDepth));
  };
  visit(node, 0);
  return { count, maxDepth, semanticTags };
}

function hasJsx(node: ts.Node): boolean {
  let found = false;
  const visit = (current: ts.Node) => {
    if (
      ts.isJsxElement(current) ||
      ts.isJsxSelfClosingElement(current) ||
      ts.isJsxFragment(current)
    ) {
      found = true;
      return;
    }
    if (!found) ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function isExported(node: ts.Node): boolean {
  return Boolean(
    ts.canHaveModifiers(node) &&
    ts
      .getModifiers(node)
      ?.some(
        (modifier) =>
          modifier.kind === ts.SyntaxKind.ExportKeyword ||
          modifier.kind === ts.SyntaxKind.DefaultKeyword
      )
  );
}

function analyzeModule(
  filePath: string,
  content: string,
  allPaths: ReadonlySet<string>
): ModuleInfo {
  const source = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    ),
    imports = new Map<string, string>(),
    jsxUsages = new Set<string>(),
    components: ComponentInfo[] = [],
    inlineData: { entries: number; line: number }[] = [];

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const target = resolveImport(filePath, statement.moduleSpecifier.text, allPaths);
      if (!target || !statement.importClause) continue;
      if (statement.importClause.name) imports.set(statement.importClause.name.text, target);
      const bindings = statement.importClause.namedBindings;
      if (bindings && ts.isNamedImports(bindings))
        for (const element of bindings.elements) imports.set(element.name.text, target);
    }

    let name: string | undefined,
      body: ts.Node | undefined,
      acceptsProps = false,
      typedProps = false,
      exported = isExported(statement);
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) {
      name = statement.name.text;
      body = statement.body;
      acceptsProps = statement.parameters.length > 0;
      typedProps = !acceptsProps || Boolean(statement.parameters[0]?.type);
    } else if (ts.isVariableStatement(statement)) {
      exported = exported || isExported(statement);
      const declaration = statement.declarationList.declarations.find(
        (item) =>
          ts.isIdentifier(item.name) &&
          item.initializer &&
          (ts.isArrowFunction(item.initializer) || ts.isFunctionExpression(item.initializer))
      );
      if (
        declaration &&
        ts.isIdentifier(declaration.name) &&
        declaration.initializer &&
        (ts.isArrowFunction(declaration.initializer) ||
          ts.isFunctionExpression(declaration.initializer))
      ) {
        name = declaration.name.text;
        body = declaration.initializer.body;
        acceptsProps = declaration.initializer.parameters.length > 0;
        typedProps =
          !acceptsProps ||
          Boolean(declaration.initializer.parameters[0]?.type) ||
          Boolean(declaration.type);
      }
    }
    if (name && /^[A-Z]/.test(name) && body && hasJsx(body)) {
      const metrics = jsxMetrics(body);
      components.push({
        name,
        path: filePath,
        jsxElements: metrics.count,
        maxJsxDepth: metrics.maxDepth,
        semanticTags: metrics.semanticTags,
        typedProps,
        acceptsProps,
        exported,
        node: body
      });
    }
  }

  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
      jsxUsages.add(componentNameFromTag(node.tagName));
    if (ts.isArrayLiteralExpression(node)) {
      const primitiveEntries = node.elements.filter(
        (element) =>
          ts.isObjectLiteralExpression(element) ||
          ts.isArrayLiteralExpression(element) ||
          ts.isStringLiteralLike(element) ||
          ts.isNumericLiteral(element)
      ).length;
      if (node.elements.length >= 6 && primitiveEntries === node.elements.length) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        inlineData.push({ entries: node.elements.length, line });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { path: filePath, source, components, imports, jsxUsages, inlineData };
}

function meaningful(component: ComponentInfo): boolean {
  return (
    component.jsxElements >= 3 ||
    [...component.semanticTags].some((tag) =>
      ['main', 'section', 'article', 'nav', 'header', 'footer'].includes(tag)
    )
  );
}

function jsxFingerprint(node: ts.Node): { value: string; size: number } {
  const parts: string[] = [];
  let size = 0;
  const visit = (current: ts.Node) => {
    if (ts.isJsxElement(current)) {
      parts.push(`<${current.openingElement.tagName.getText().toLowerCase()}>`);
      size += 1;
    } else if (ts.isJsxSelfClosingElement(current)) {
      parts.push(`<${current.tagName.getText().toLowerCase()}/>`);
      size += 1;
    } else if (ts.isJsxExpression(current)) parts.push('{}');
    ts.forEachChild(current, visit);
  };
  visit(node);
  return { value: parts.join(''), size };
}

function findDuplicatedSubtrees(modules: readonly ModuleInfo[]) {
  const occurrences = new Map<string, Set<string>>();
  for (const module of modules)
    for (const component of module.components) {
      const visit = (node: ts.Node) => {
        if (ts.isJsxElement(node) || ts.isJsxFragment(node)) {
          const fingerprint = jsxFingerprint(node);
          if (fingerprint.size >= 10) {
            const key = fingerprint.value;
            const locations = occurrences.get(key) ?? new Set<string>();
            locations.add(`${component.path}#${component.name}`);
            occurrences.set(key, locations);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(component.node);
    }
  return [...occurrences.entries()]
    .filter(([, locations]) => locations.size >= 2)
    .map(([fingerprint, locations]) => ({
      fingerprint: fingerprint.slice(0, 160),
      occurrences: [...locations].sort()
    }));
}

function routeMapping(
  route: string,
  app: ModuleInfo | undefined,
  pageModulePaths: ReadonlySet<string>
): string | null {
  if (!app) return null;
  let mapped: string | null = null;
  const importedPage = (name: string) => {
    const target = app.imports.get(name);
    if (target && pageModulePaths.has(target)) mapped = target;
  };
  const visit = (node: ts.Node) => {
    if (mapped) return;
    ts.forEachChild(node, visit);
    if (mapped) return;
    if (ts.isPropertyAssignment(node)) {
      const key =
        ts.isStringLiteralLike(node.name) || ts.isNumericLiteral(node.name)
          ? node.name.text
          : node.name.getText(app.source);
      if (
        key === route ||
        node.getText(app.source).includes(`'${route}'`) ||
        node.getText(app.source).includes(`"${route}"`)
      ) {
        if (ts.isIdentifier(node.initializer)) importedPage(node.initializer.text);
        const inner = (child: ts.Node) => {
          if (ts.isIdentifier(child)) importedPage(child.text);
          ts.forEachChild(child, inner);
        };
        inner(node.initializer);
      }
    }
    const text = node.getText(app.source);
    if (
      (text.includes(`'${route}'`) || text.includes(`"${route}"`)) &&
      (ts.isConditionalExpression(node) ||
        ts.isCaseClause(node) ||
        ts.isIfStatement(node) ||
        ts.isArrayLiteralExpression(node) ||
        ts.isObjectLiteralExpression(node))
    ) {
      const inner = (child: ts.Node) => {
        if (ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child))
          importedPage(componentNameFromTag(child.tagName));
        if (ts.isIdentifier(child)) importedPage(child.text);
        ts.forEachChild(child, inner);
      };
      inner(node);
    }
  };
  visit(app.source);
  return mapped;
}

function sharedRegionKey(value: string): string | null {
  const normalized = value.toLowerCase();
  return (
    Object.keys(interfaceRegionAliases).find((key) =>
      interfaceRegionAliases[key]!.some((alias) => normalized.includes(alias))
    ) ?? null
  );
}

export function analyzeReactArchitecture(
  project: GeneratedProject,
  request: ProjectGenerationRequest
): ArchitectureAnalysis {
  const reactFiles = project.files.filter(
      (file) => file.kind === 'react' || file.path.endsWith('.tsx') || file.path.endsWith('.ts')
    ),
    allPaths = new Set(reactFiles.map((file) => normalizeFilePath(file.path))),
    modules = reactFiles.map((file) =>
      analyzeModule(normalizeFilePath(file.path), file.content, allPaths)
    ),
    app = modules.find((module) => module.path.toLowerCase() === 'src/app.tsx'),
    pages = request.context.pageMap.pages,
    isMultiRoute = request.context.pageMap.kind === 'multi-page' || pages.length > 1,
    requiredSectionCount = pages.reduce((total, page) => total + page.requiredSections.length, 0),
    substantialSingle = !isMultiRoute && requiredSectionCount >= 4,
    complexity = isMultiRoute
      ? ('multi-route' as const)
      : substantialSingle
        ? ('substantial-single-page' as const)
        : ('small' as const);

  const componentUsage = new Map<string, number>();
  for (const module of modules)
    for (const usage of module.jsxUsages)
      componentUsage.set(usage, (componentUsage.get(usage) ?? 0) + 1);

  const pageModules = modules.filter(
      (module) =>
        module.path.toLowerCase() !== 'src/app.tsx' &&
        (/(^|\/)pages?\//i.test(module.path) ||
          module.components.some(
            (component) =>
              meaningful(component) &&
              (component.semanticTags.has('main') || component.semanticTags.has('h1'))
          ))
    ),
    pageModulePaths = new Set(pageModules.map((module) => module.path)),
    routeMappings = Object.fromEntries(
      pages.map((page) => [page.route, routeMapping(page.route, app, pageModulePaths)])
    ),
    sharedComponents = modules
      .filter((module) => {
        if (module === app || pageModulePaths.has(module.path)) return false;
        return module.components.some((component) => {
          const semanticShared = [...component.semanticTags].some((tag) =>
            ['nav', 'header', 'footer'].includes(tag)
          );
          const usedByPages = pageModules.filter((pageModule) =>
            [...pageModule.imports.entries()].some(
              ([name, target]) => target === module.path && pageModule.jsxUsages.has(name)
            )
          ).length;
          const usedByApp = app
            ? [...app.imports.entries()].some(
                ([name, target]) => target === module.path && app.jsxUsages.has(name)
              )
            : false;
          return meaningful(component) && (semanticShared || usedByPages >= 2 || usedByApp);
        });
      })
      .map((module) => module.path)
      .sort();

  const typed: string[] = [],
    untyped: string[] = [];
  for (const module of modules)
    for (const component of module.components)
      if (
        component.acceptsProps &&
        (component.exported || (componentUsage.get(component.name) ?? 0) > 0)
      )
        (component.typedProps ? typed : untyped).push(`${component.path}#${component.name}`);

  const duplicatedSubtrees = findDuplicatedSubtrees(modules),
    inlineData = modules.flatMap((module) =>
      module.inlineData.map((data) => ({ path: module.path, ...data }))
    ),
    stylesheets = project.files
      .filter((file) => file.kind === 'stylesheet' || file.path.endsWith('.css'))
      .map((file) => ({
        path: normalizeFilePath(file.path),
        characters: file.content.length,
        rules: (file.content.match(/{/g) ?? []).length
      }))
      .sort((left, right) => left.path.localeCompare(right.path)),
    appComponents = app?.components ?? [],
    appJsx = appComponents.reduce((total, component) => total + component.jsxElements, 0),
    appMaxDepth = Math.max(0, ...appComponents.map((component) => component.maxJsxDepth)),
    appFullPages = appComponents.filter(
      (component) => component.semanticTags.has('main') || component.semanticTags.has('h1')
    ).length,
    largestComponent = modules
      .flatMap((module) => module.components)
      .sort((left, right) => right.jsxElements - left.jsxElements)[0],
    largest = [...modules]
      .map((module) => ({
        path: module.path,
        jsxElements: module.components.reduce(
          (total, component) => total + component.jsxElements,
          0
        ),
        components: module.components.length
      }))
      .sort((left, right) => right.jsxElements - left.jsxElements)[0] ?? {
      path: 'src/App.tsx',
      jsxElements: 0,
      components: 0
    },
    evidence: ArchitectureEvidence = {
      complexity,
      largestModule: largest,
      largestComponent: largestComponent
        ? {
            path: largestComponent.path,
            name: largestComponent.name,
            jsxElements: largestComponent.jsxElements
          }
        : null,
      app: {
        jsxElements: appJsx,
        maxJsxDepth: appMaxDepth,
        fullPageComponents: appFullPages
      },
      pageModules: pageModules.map((module) => module.path).sort(),
      routeMappings,
      sharedComponents,
      props: { typed: typed.sort(), untyped: untyped.sort() },
      duplicatedSubtrees,
      inlineData,
      stylesheets
    },
    findings: ArchitectureFinding[] = [];

  const add = (
    id: ArchitectureFinding['id'],
    severity: ArchitectureSeverity,
    message: string,
    detail: Readonly<Record<string, unknown>>
  ) => findings.push({ id, severity, message, evidence: detail });

  const meaningfulOutsideApp = modules
    .filter((module) => module !== app)
    .flatMap((module) => module.components)
    .filter(meaningful);
  if (
    (isMultiRoute && meaningfulOutsideApp.length === 0) ||
    (substantialSingle && meaningfulOutsideApp.length < 2 && appJsx >= 12)
  )
    add(
      'ARCH_APP_MONOLITH',
      'error',
      isMultiRoute
        ? 'Nontrivial multi-route projects must not place the complete implementation in App.tsx.'
        : 'This substantial single-page plan needs cohesive section or feature components outside App.tsx.',
      {
        complexity,
        appJsxElements: appJsx,
        meaningfulComponentsOutsideApp: meaningfulOutsideApp.length
      }
    );

  if (isMultiRoute && pageModules.length === 0)
    add(
      'ARCH_PAGE_MODULES_REQUIRED',
      'error',
      'Multi-route projects require identifiable page modules outside App.tsx.',
      { approvedRoutes: pages.map((page) => page.route), discoveredPageModules: [] }
    );

  const unmappedRoutes = Object.entries(routeMappings)
    .filter(([, modulePath]) => modulePath === null)
    .map(([route]) => route);
  if (isMultiRoute && unmappedRoutes.length > 0)
    add(
      'ARCH_ROUTE_PAGE_COVERAGE',
      'error',
      `Every approved route must map to an imported page component; unmapped: ${unmappedRoutes.join(', ')}.`,
      { approvedRoutes: pages.map((page) => page.route), routeMappings }
    );

  const expectedSharedRegions = [
    ...new Set(
      pages
        .flatMap((page) => page.sharedElements)
        .map(sharedRegionKey)
        .filter((value): value is string => value !== null)
    )
  ];
  const discoveredSharedText = sharedComponents
    .flatMap((modulePath) => {
      const module = modules.find((candidate) => candidate.path === modulePath);
      return [
        modulePath.toLowerCase(),
        ...(module?.components.map((component) => component.name.toLowerCase()) ?? []),
        ...[...(module?.components.flatMap((component) => [...component.semanticTags]) ?? [])]
      ];
    })
    .join(' ');
  const missingSharedRegions = expectedSharedRegions.filter(
    (region) =>
      !interfaceRegionAliases[region]!.some((alias) => discoveredSharedText.includes(alias))
  );
  if (isMultiRoute && expectedSharedRegions.length > 0 && missingSharedRegions.length > 0)
    add(
      'ARCH_SHARED_REGION_EXTRACTION',
      'error',
      `Plan-declared shared interface regions need reusable modules; missing: ${missingSharedRegions.join(', ')}.`,
      { expectedSharedRegions, missingSharedRegions, sharedComponents }
    );

  if (isMultiRoute && appFullPages >= 2)
    add(
      'ARCH_APP_MULTIPLE_PAGES',
      'error',
      'App.tsx contains multiple full page implementations; keep it focused on routing and top-level composition.',
      { fullPageComponents: appFullPages, appComponents: appComponents.map((item) => item.name) }
    );

  if (untyped.length > 0)
    add(
      'ARCH_TYPED_PROPS',
      'error',
      'Configurable exported or reused components need explicit TypeScript props types.',
      { untypedComponents: untyped, typedComponents: typed }
    );

  if (duplicatedSubtrees.length > 0)
    add(
      'ARCH_DUPLICATED_JSX',
      'error',
      'Substantial duplicated JSX structures indicate a missing shared component.',
      { duplicatedSubtrees }
    );

  if (inlineData.length > 0)
    add(
      'ARCH_INLINE_DATA',
      'warning',
      'Large inline content collections should move to a data module when they are content rather than rendering logic.',
      { collections: inlineData }
    );

  const totalJsx = modules.reduce(
      (total, module) =>
        total +
        module.components.reduce(
          (componentTotal, component) => componentTotal + component.jsxElements,
          0
        ),
      0
    ),
    visuallySubstantial = isMultiRoute || requiredSectionCount >= 4 || totalJsx >= 35,
    weakStyles =
      visuallySubstantial &&
      stylesheets.length === 1 &&
      (stylesheets[0]!.characters >= 1_500 || stylesheets[0]!.rules >= 18);
  if (weakStyles)
    add(
      'ARCH_STYLESHEET_ORGANIZATION',
      'warning',
      'A visually substantial project would benefit from separating tokens, shared components, or page-level CSS behind the root stylesheet entrypoint.',
      { stylesheets, totalJsxElements: totalJsx, requiredSectionCount }
    );

  const overloadedModules = modules
    .filter((module) => module.components.filter(meaningful).length >= 4)
    .map((module) => ({
      path: module.path,
      components: module.components.filter(meaningful).map((component) => component.name)
    }));
  if (overloadedModules.length > 0)
    add(
      'ARCH_MODULE_RESPONSIBILITY',
      'warning',
      'Some modules contain several substantial component responsibilities and may benefit from clearer feature boundaries.',
      { modules: overloadedModules }
    );

  if (!findings.some((finding) => finding.id === 'ARCH_APP_MONOLITH') && appJsx >= 18)
    add(
      'ARCH_APP_COMPLEXITY',
      'warning',
      'App.tsx is approaching page-level JSX complexity; keep it focused on routing and top-level composition.',
      { appJsxElements: appJsx, maxJsxDepth: appMaxDepth }
    );

  return { findings, evidence };
}
