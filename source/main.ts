import 'colors'

import defaults from './defaults'
import DotEnv from 'dotenv'

import { existsSync, readFileSync } from 'fs'
import TOML from 'toml'
import YAML from 'yaml'

import ParseEnvValue from './utils/Parse.util'

DotEnv.config()

if (!process.env['MOZZ_ENV']) throw new Error(`Mozz environment is not defined`)

interface MozzProfileSettingsType {
    allowUndefinedValues?: boolean
}

interface MozzProfileObjectType {
    settings: MozzProfileSettingsType
    environments: {
        [Env: string]: {
            [property: string]: number | boolean | string
        }
    }
}

export default class Mozz {
    pid: number = process.pid
    env: {
        [key: string]: unknown
        NAME: string
        MOZZ_VERSION: string
        MOZZ_SETTINGS: MozzProfileSettingsType
    } = {
        NAME: String(process.env['MOZZ_ENV']),
        MOZZ_VERSION: defaults.version,
        MOZZ_SETTINGS: {},
    }

    constructor() {
        this.#config()
    }

    #config(environment?: string) {
        if (
            !existsSync(
                `${process.cwd()}/${defaults.applicationConfigFilename}`
            )
        ) {
            throw new Error(
                `If you're using ${'Mozz'.yellow} with your ${
                    'workspace enhancer'.yellow
                } you need to setup \`${
                    defaults.applicationConfigFilename
                }\` file.`
            )
        }

        const RawMozzObject: MozzProfileObjectType = JSON.parse(
            readFileSync(
                `${process.cwd()}/${defaults.applicationConfigFilename}`,
                {
                    encoding: 'utf-8',
                }
            )
        )

        this.env.NAME = String(environment || process.env['MOZZ_ENV'])
        this.env.MOZZ_SETTINGS = Object.assign(
            Object(RawMozzObject.settings),
            defaults.settings
        )

        const MozzConfig =
            RawMozzObject.environments[
                (environment ||
                    process.env['MOZZ_ENV']) as keyof MozzProfileObjectType
            ]

        if (Object(MozzConfig).length >= 1 || !MozzConfig) {
            throw new Error(
                `Mozz "${
                    String(this.env.MOZZ_ENV).cyan
                }" environment doesn't exists`
            )
        }

        process.env['MOZZ_VERSION'] = this.env.MOZZ_VERSION
        if (
            MozzConfig['@mozz:dotenv'] &&
            typeof MozzConfig['@mozz:dotenv'] == 'string'
        ) {
            DotEnv.config({
                path: `${process.cwd()}/${MozzConfig['@mozz:dotenv']}`,
                override: true,
            })
        }

        if (
            MozzConfig['@mozz:config_file'] &&
            typeof MozzConfig['@mozz:config_file'] == 'string'
        ) {
            const splittedFilename = String(
                MozzConfig['@mozz:config_file']
            ).split('.')
            const fileType = splittedFilename[splittedFilename.length - 1]
            const fileContent = readFileSync(
                `${process.cwd()}/${MozzConfig['@mozz:config_file']}`,
                'utf-8'
            )

            let ParsedConfigFileData: Object = {}

            switch (fileType.toLowerCase()) {
                case 'json':
                    ParsedConfigFileData = JSON.parse(fileContent)
                    break

                case 'toml':
                    ParsedConfigFileData = TOML.parse(fileContent)
                    break

                case 'yaml':
                    ParsedConfigFileData = YAML.parse(fileContent)
                    break

                case 'yml':
                    ParsedConfigFileData = YAML.parse(fileContent)
                    break

                default:
                    ParsedConfigFileData = MozzConfig
            }

            this.#iterate(ParsedConfigFileData)
        } else {
            this.#iterate(MozzConfig)
        }

        return true
    }

    #iterate<T = object>(input: T) {
        const response = {}

        for (const item in input) {
            const value = ParseEnvValue(input[item as keyof object])

            if (
                typeof value == 'undefined' &&
                !this.env.MOZZ_SETTINGS.allowUndefinedValues
            ) {
                throw new Error(
                    `${
                        `"${item}"`.cyan
                    } has been assigned an undefined value. Try enabling the ${
                        '"allowUndefinedValues"'.green
                    } option.`
                )
            }

            this.env[String(item)] = value
        }
    }
}
