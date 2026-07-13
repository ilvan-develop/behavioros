import type { Command } from 'commander'
import chalk from 'chalk'
import ora from 'ora'
import Table from 'cli-table3'
import { DNALoader, DNAValidator } from '@behavioros/core'
import { cosmiconfig } from 'cosmiconfig'

export function validateCommand(program: Command): void {
  program
    .command('validate [path]')
    .description('Validate a behavioros.yaml DNA file')
    .action(async (path?: string) => {
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
                  'Run `behavioros init` to create one, or specify a path: behavioros validate ./path/to/dna.yaml',
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
        spinner.start('Validating...')

        const result = DNAValidator.validate(dna)

        if (result.valid) {
          spinner.succeed('Validation passed')
        } else {
          spinner.fail('Validation failed')
        }

        // Errors table
        if (result.errors.length > 0) {
          const errorTable = new Table({
            head: [
              chalk.red.bold('Code'),
              chalk.red.bold('Path'),
              chalk.red.bold('Message'),
            ],
            style: { head: [] },
          })

          for (const error of result.errors) {
            errorTable.push([error.code, error.path, error.message])
          }

          console.log(chalk.bold('\nErrors:'))
          console.log(errorTable.toString())
        }

        // Warnings table
        if (result.warnings.length > 0) {
          const warningTable = new Table({
            head: [
              chalk.yellow.bold('Code'),
              chalk.yellow.bold('Path'),
              chalk.yellow.bold('Message'),
            ],
            style: { head: [] },
          })

          for (const warning of result.warnings) {
            warningTable.push([warning.code, warning.path, warning.message])
          }

          console.log(chalk.bold('\nWarnings:'))
          console.log(warningTable.toString())
        }

        // Summary
        console.log(chalk.bold('\nSummary:'))
        console.log(
          `  ${chalk.cyan('Valid:')}    ${result.valid ? chalk.green('Yes') : chalk.red('No')}`,
        )
        console.log(
          `  ${chalk.cyan('Errors:')}   ${result.errors.length === 0 ? chalk.green('0') : chalk.red(String(result.errors.length))}`,
        )
        console.log(
          `  ${chalk.cyan('Warnings:')} ${result.warnings.length === 0 ? chalk.green('0') : chalk.yellow(String(result.warnings.length))}`,
        )
        console.log('')

        if (!result.valid) {
          process.exitCode = 1
        }
      } catch (err) {
        spinner.fail('Validation failed')
        console.error(chalk.red(`\n${String(err)}\n`))
        process.exitCode = 1
      }
    })
}
