/*
 * Copyright 2022 Polago AB.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const core = require('@actions/core');
const github = require('@actions/github');
const util = require('node:util');
const exec = util.promisify(require('child_process').exec);

async function digestForImage(image, os, arch, variant) {
    let cmd = 'skopeo'
    if (os) {
        cmd += ' --override-os=' + os;
    }
    if (arch) {
        cmd += ' --override-arch=' + arch;
    }

    if (variant) {
        cmd += ' --override-variant=' + variant;
    }

    // TODO add --no-tags when the option is available in the runner
    cmd += " inspect --format '{{.Digest}}' "
    cmd += 'docker://' + image

    core.debug('Using skopeo command: ' + cmd)

    try {
        const { stdout, stderr } = await exec(cmd)
        core.debug(`skopeo result: ${stdout}`)
        return stdout.trim()
    } catch (e) {
        core.debug(`stderr: ${e.message}`)
        return ''
    }
}

function paddingFromStrategy(strategy) {
    const parts = strategy.split(':')

    if (strategy === '' || parts[0] === 'numerical') {
        return 0
    } else if (parts[0] === 'alphabetical') {
        if (parts[1] === undefined) {
            return 3
        } else if (!isNaN(parts[1])) {
            return parts[1]
        }
        throw new Error("Unrecognized alphabetical padding: " + parts[1])
    }
    throw new Error("Unrecognized strategy: " + strategy)
}

async function revisionForImage(image, strategy) {
    const parts = image.split(':')
    const plainImage = parts[0]
    const version = parts[1]

    if (version === undefined) {
        throw new Error("No version specified in image: " + image)
    }

    let cmd = 'skopeo list-tags '
    cmd += 'docker://' + plainImage

    core.debug('Using skopeo command: ' + cmd)

    try {
        const { stdout, stderr } = await exec(cmd)
        core.debug(`skopeo result: ${stdout}`)

        const result = JSON.parse(stdout)
        const tags = result.Tags.filter(tag => tag.startsWith(version)).sort()
        if (tags.length === 0) {
            throw new Error("No version tag found for image: " + image)
        }
        return version + '-' + String(tags.length).padStart(paddingFromStrategy(strategy), '0')
    } catch (e) {
        core.debug(`stderr: ${e.message}`)
        throw e
    }
}

async function tagRevision(image, revision, digest, os, arch, variant) {
    core.debug(`tagging image ${image} with revision ${revision}`)
    let cmd = 'docker buildx imagetools create '
    cmd += image
    cmd += ' --tag ' + image.split(':')[0] + ':' + revision

    core.debug('Using docker command: ' + cmd)

    try {
        const { stdout, stderr } = await exec(cmd)
        core.debug(`docker result: ${stdout}`)
        return stdout.trim()
    } catch (e) {
        core.debug(`stderr: ${e.message}`)
        return ''
    }
}

async function action(image, digest, strategy, os, arch, variant) {
    const newDigest = await digestForImage(image, os, arch, variant)
    if (newDigest === '') {
        throw new Error("No existing digest found for image: " + image)
    }
    core.setOutput('digest', newDigest)
    if (newDigest !== digest) {
        const revision = await revisionForImage(image, strategy)
        await tagRevision(image, revision)
        core.info('Created revision ' + revision + ' for image: ' + image)
        core.setOutput('revision', revision)
    } else {
        core.info('No revision created')
    }
}

async function runAction() {
    try {
        const image = core.getInput('image');
        const digest = core.getInput('digest');
        const strategy = core.getInput('strategy');
        const os = core.getInput('os');
        const arch = core.getInput('arch');
        const variant = core.getInput('variant');
        await action(image, digest, strategy, os, arch, variant)
    } catch (error) {
        core.setFailed(error.message);
    }
}
module.exports = runAction
