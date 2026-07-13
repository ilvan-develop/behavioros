import type { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import { BehaviorCompiler, DNALoader } from '@behavioros/core'
import { cosmiconfig } from 'cosmiconfig'

export function compileCommand(program: Command): void {
  program
    .command('compile [path]')
    .description('Compile a behavioros.yaml DNA package into generated organization files')
    .option('-o, --output <dir>', 'Output directory', './generated')
    .option('-n, --dry-run', 'Show what would be generated without writing files', false)
    .option('-v, --verbose', 'Show detailed output', false)
    .action(async (path?: string, options?: { output: string; dryRun: boolean; verbose: boolean }) => {
      const spinner = ora('Loading DNA package...').start()

      try {
        let dnaPath = path

        if (!dnaPath) {
          const explorer = cosmiconfig('behavioros', {
            searchPlaces: [
              'behavioros.yaml',
              'behavioros.yml',
              '.behaviorosrc',
              '.behaviorosrc.yaml',
              '.behaviorosrc.yml',
              '.behaviorosrc.json',
              'behavioros.config.js',
            ],
          })

          spinner.text = 'Searching for behavioros config...'
          const result = await explorer.search()

          if (!result) {
            spinner.fail('No behavioros configuration found')
            console.log(
              chalk.red(
                '\nNo behavioros.yaml, .behaviorosrc, or behavioros config found.\n' +
                  'Run `behavioros init` to create one, or specify a path: behavioros compile ./path/to/dna.yaml',
              ),
            )
            process.exitCode = 1
            return
          }

          dnaPath = result.filepath
        }

        spinner.text = `Loading DNA from ${dnaPath}...`
        const loader = new DNALoader({ validate: true })
        const dna = loader.load(dnaPath)

        spinner.succeed(`Loaded DNA: ${chalk.bold(dna.name)} v${dna.version}`)
        spinner.start('Compiling...')

        const compiler = new BehaviorCompiler({
          outputDir: options?.output ?? './generated',
          dryRun: options?.dryRun ?? false,
          verbose: options?.verbose ?? false,
        })

        const output = compiler.compile(dna)

        if (options?.dryRun) {
          spinner.succeed('Compilation complete (dry run — no files written)\n')
        } else {
          spinner.succeed(`Compilation complete`)
        }

        // Summary
        console.log(chalk.bold('\nGenerated Organization:'))
        console.log(`  ${chalk.cyan('Name:')}      ${output.organization.name}`)
        console.log(`  ${chalk.cyan('Agents:')}    ${output.organization.agents.length}`)
        console.log(`  ${chalk.cyan('Workflows:')} ${output.organization.workflows.length}`)
        console.log(`  ${chalk.cyan('Hooks:')}     ${output.organization.hooks.length}`)
        console.log(`  ${chalk.cyan('Files:')}     ${output.files.length}`)

        if (options?.verbose || options?.dryRun) {
          console.log(chalk.bold('\nFiles:'))
          for (const file of output.files) {
            const icon = file.type === 'typescript' ? '📄' : file.type === 'yaml' ? '📋' : file.type === 'json' ? '🔧' : '📝'
            console.log(`  ${icon} ${file.path} (${file.type})`)
          }
        }

        if (!options?.dryRun) {
          console.log(
            chalk.green(`\n✅ Output written to ${chalk.bold(options?.output ?? './generated')}`),
          )
        }

        console.log('')
      } catch (err) {
        spinner.fail('Compilation failed')
        console.error(chalk.red(`\n${String(err)}\n`))
        process.exitCode = 1
      }
    })
}
