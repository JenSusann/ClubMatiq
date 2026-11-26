
import fs from 'node:fs';
import path from 'node:path';

import libCoverage from 'istanbul-lib-coverage';
import libReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';

const { createCoverageMap } = libCoverage;
const { createContext } = libReport;

const root = process.cwd();

const inputFiles = [
  path.join(root, 'coverage/unit/coverage-final.json'),
  path.join(root, 'coverage/integration/coverage-final.json')
];

const outputDirectory = path.join(root, 'coverage/combined');

const coverageMap = createCoverageMap({});

try {
  for (const inputFile of inputFiles) {
    if (!fs.existsSync(inputFile)) {
      throw new Error(
        `Coverage-Datei nicht gefunden: ${inputFile}`
      );
    }

    const coverage = JSON.parse(
      fs.readFileSync(inputFile, 'utf8')
    );

    if (Object.keys(coverage).length === 0) {
      throw new Error(
        `Coverage-Datei ist leer: ${inputFile}`
      );
    }

    coverageMap.merge(coverage);

    console.log(
      `Coverage geladen: ${path.relative(root, inputFile)}`
    );
  }

  fs.rmSync(outputDirectory, {
    recursive: true,
    force: true
  });

  fs.mkdirSync(outputDirectory, {
    recursive: true
  });

  const context = createContext({
    dir: outputDirectory,
    coverageMap
  });

  const reportTypes = [
    'text',
    'html',
    'json',
    'json-summary',
    'lcov'
  ];

  for (const reportType of reportTypes) {
    reports.create(reportType).execute(context);
  }

  const summary = coverageMap.getCoverageSummary();

  console.log('\n=== Kombinierte Code Coverage ===\n');

  console.table(
    Object.fromEntries(
      ['statements', 'branches', 'functions', 'lines'].map(
        (metric) => [
          metric,
          {
            Total: summary[metric].total,
            Abgedeckt: summary[metric].covered,
            'Coverage (%)': summary[metric].pct
          }
        ]
      )
    )
  );

  console.log(
    `\nBerichte erstellt: ${path.relative(root, outputDirectory)}`
  );

} catch (error) {
  console.error('\nCoverage-Zusammenführung fehlgeschlagen:');
  console.error(error.message);
  process.exitCode = 1;
}
