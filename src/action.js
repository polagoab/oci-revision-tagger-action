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

    core.debug(`Using skopeo command: ${cmd}`)

    try {
        const { stdout, stderr } = await exec(cmd)
        core.debug(`skopeo result for image '${image}': ${stdout}`)
        return stdout.trim()
    } catch (e) {
        core.debug(`stderr for image '${image}': ${e.message}`)
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

function revisionFromTag(tag, version) {
    const revisionStart = tag.lastIndexOf('-')
    if (!tag || revisionStart < 0 || tag === version) {
        return 0
    }
    return tag.substring(revisionStart + 1)
}

function revisionFromTags(tags, version, strategy) {
    let existingRevision = 0
    if (tags.length > 1) {
        existingRevision = tags.reduce((p, c) => {
            return Math.max(revisionFromTag(p, version), revisionFromTag(c, version))
        })
    }

    return String(existingRevision + 1).padStart(paddingFromStrategy(strategy), '0')
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

    core.debug(`Using skopeo command: ${cmd}`)

    try {
        const { stdout, stderr } = await exec(cmd)
        core.debug(`skopeo result for image '${image}': ${stdout}`)

        const result = JSON.parse(stdout)

        const tags = result.Tags.filter(tag => tag.startsWith(version))
        if (tags.length === 0) {
            throw new Error("No version tag found for image: " + image)
        }
        return version + '-' + revisionFromTags(tags, version, strategy)
    } catch (e) {
        core.debug(`stderr for image '${image}': ${e.message}`)
        throw e
    }
}

async function tagRevision(image, revision, digest, os, arch, variant) {
    core.debug(`tagging image ${image} with revision ${revision}`)
    let cmd = 'docker buildx imagetools create '
    cmd += image
    cmd += ' --tag ' + image.split(':')[0] + ':' + revision

    core.debug(`Using docker command for image '${image}': ${cmd}`)

    try {
        const { stdout, stderr } = await exec(cmd)
        core.debug(`docker result for image '${image}': ${stdout}`)
        return stdout.trim()
    } catch (e) {
        core.debug(`stderr for image '${image}': ${e.message}`)
        throw e
    }
}

async function processSingleImage(image, digest, strategy, os, arch, variant) {
    const newDigest = await digestForImage(image, os, arch, variant)
    if (newDigest === '') {
        throw new Error("No existing digest found for image: " + image)
    }
    core.info('Image: ' + image)
    core.info('Existing digest: ' + digest)
    core.info('New digest: ' + newDigest)

    core.setOutput('digest', newDigest)

    if (newDigest !== digest) {
        const revision = await revisionForImage(image, strategy)
        await tagRevision(image, revision)
        core.info('Created new revision: ' + revision)
        core.setOutput('revision', revision)
    } else {
        core.info('No revision created')
    }
}

async function processMultipleImages(images, digestString, strategy, os, arch, variant) {
    let digests = []

    try {
        if (digestString) {
            digests = JSON.parse(digestString)
        }
    } catch (error) {
        core.debug('Unable to parse digests as JSON: ' + error.message)
    }

    await Promise.all(images.map(async image => {
        const newDigest = await digestForImage(image, os, arch, variant)
        if (newDigest === '') {
            throw new Error("No existing digest found for image: " + image)
        }
        const digest = digests[images.findIndex((element) => { return element === image })]
        let revision

        if (newDigest !== digest) {
            revision = await revisionForImage(image, strategy)
            await tagRevision(image, revision)
        }

        return { revision: revision, image: image, newDigest: newDigest, existingDigest: digest }

    })).then(result => {
        const revisionsResult = []
        const digestsResult = []

        result.forEach((element) => {
            revisionsResult.push(element.revision)
            digestsResult.push(element.newDigest)

            core.startGroup(element.image)
            core.info('Existing digest: ' + element.existingDigest)
            core.info('New digest: ' + element.newDigest)
            if (element.newDigest !== element.existingDigest) {
                core.info('Created new revision: ' + element.revision)
            } else {
                core.info('No revision created')
            }
            core.endGroup()
        })

        core.setOutput('digest', JSON.stringify(digestsResult))
        if (!revisionsResult.every((value) => {
            return typeof value === 'undefined'
        })) {
            core.setOutput('revision', JSON.stringify(revisionsResult))
        }
    })
}

async function action() {
    try {
        let image = core.getInput('image')
        const digest = core.getInput('digest');
        const strategy = core.getInput('strategy');
        const os = core.getInput('os');
        const arch = core.getInput('arch');
        const variant = core.getInput('variant');

        try {
            image = JSON.parse(image)
        } catch (error) {
            core.debug('Unable to parse image as JSON: ' + error.message)
        }

        if (Array.isArray(image)) {
            await processMultipleImages(image, digest, strategy, os, arch, variant)
        } else {
            await processSingleImage(image, digest, strategy, os, arch, variant)
        }
    } catch (error) {
        core.setFailed(error.message);
    }
}
module.exports = action
