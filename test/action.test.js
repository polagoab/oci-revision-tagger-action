'use strict';

const { RunOptions, RunTarget } = require('github-action-ts-run-api');

const child_process = require('child_process')
jest.mock("child_process")
jest.setTimeout(100000)

const runAction = require('../src/action');

describe(`Single image tests`, () => {
    const digest = 'sha256:42'

    beforeEach(() => {
        jest.resetModules();
    });

    test("Singe image with no existing digest", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: 'unknown-image:1.0.0', digest: undefined })

        child_process.exec.mockImplementation((command, callback) => {
            if (command.includes('skopeo inspect')) {
                expect(command).toBe("skopeo inspect --format '{{.Digest}}' docker://unknown-image:1.0.0")
                callback(null, { stdout: digest });
            } else if (command.includes('skopeo list-tags')) {
                expect(command).toBe("skopeo list-tags docker://unknown-image")
                callback(null, { stdout: JSON.stringify({ Tags: ['1.0.0'] }) });
            } else if (command.includes('docker buildx imagetools create')) {
                expect(command).toBe("docker buildx imagetools create unknown-image:1.0.0 --tag unknown-image:1.0.0-001")
                callback(null, { stdout: 'unknown-image:1.0.0-001' });
            } else {
                fail("Unrecognized exec call: " + command)
            }
        });

        const result = await target.run(options)

        expect(result.isSuccess)
        expect(result.commands.outputs.revision).toBe('1.0.0-001')
    })

    test("Single image with same digest", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: 'unknown-image:1.0.0', digest: digest })

        child_process.exec.mockImplementation((command, callback) => {
            expect(command).toBe("skopeo inspect --format '{{.Digest}}' docker://unknown-image:1.0.0")
            callback(null, { stdout: digest });
        });

        const result = await target.run(options)

        expect(result.isSuccess)
        expect(result.commands.outputs.digest).toBe(digest)
        expect(result.commands.outputs.revision).toBeUndefined()
    })

    test("Single image with different digest", async () => {
        const updatedDigest = 'sha256:43'
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: 'unknown-image:1.0.0', digest: digest })

        child_process.exec.mockImplementation((command, callback) => {
            if (command.includes('skopeo inspect')) {
                expect(command).toBe("skopeo inspect --format '{{.Digest}}' docker://unknown-image:1.0.0")
                callback(null, { stdout: updatedDigest });
            } else if (command.includes('skopeo list-tags')) {
                expect(command).toBe("skopeo list-tags docker://unknown-image")
                callback(null, { stdout: JSON.stringify({ Tags: ['1.0.0', '1.0.0-001'] }) });
            } else if (command.includes('docker buildx imagetools create')) {
                expect(command).toBe("docker buildx imagetools create unknown-image:1.0.0 --tag unknown-image:1.0.0-001")
                callback(null, { stdout: '' });
            } else {
                fail("Unrecognized exec call: " + command)
            }
        });

        const result = await target.run(options)

        expect(result.isSuccess)
        expect(result.commands.outputs.digest).toBe(updatedDigest)
        expect(result.commands.outputs.revision).toBe('1.0.0-002')
    })

    test("Single image with os input", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: 'unknown-image:1.0.0', os: 'linux' })

        child_process.exec.mockImplementation((command, callback) => {
            expect(command).toBe("skopeo --override-os=linux inspect --format '{{.Digest}}' docker://unknown-image:1.0.0")
            callback(null, { stdout: digest });
        });

        const result = await target.run(options)

        expect(result.isSuccess)
        expect(result.commands.outputs.digest).toBe(digest)
    })

    test("Single image with arch input", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: 'unknown-image:1.0.0', arch: 'x86' })

        child_process.exec.mockImplementation((command, callback) => {
            expect(command).toBe("skopeo --override-arch=x86 inspect --format '{{.Digest}}' docker://unknown-image:1.0.0")
            callback(null, { stdout: digest });
        });

        const result = await target.run(options)

        expect(result.isSuccess)
        expect(result.commands.outputs.digest).toBe(digest)
    })

    test("Single image with variant input", async () => {
        const target = RunTarget.asyncFn(runAction);
        const options = RunOptions.create()
            .setInputs({ image: 'unknown-image:1.0.0', variant: 'v6' })

        child_process.exec.mockImplementation((command, callback) => {
            expect(command).toBe("skopeo --override-variant=v6 inspect --format '{{.Digest}}' docker://unknown-image:1.0.0")
            callback(null, { stdout: digest });
        });

        const result = await target.run(options)

        expect(result.isSuccess)
        expect(result.commands.outputs.digest).toBe(digest)
    })

})
