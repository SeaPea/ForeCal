import json
import os
import re

from waflib.Configure import conf

top = '.'
out = 'build'


def options(ctx):
    ctx.load('pebble_sdk')


def configure(ctx):
    ctx.load('pebble_sdk')

    if ctx.env.TARGET_PLATFORMS:
        for platform in ctx.env.TARGET_PLATFORMS:
            ctx.configure_platform(platform)
    else:
        ctx.configure_platform()


def build(ctx):
    ctx.load('pebble_sdk')

    binaries = []
    js_target = ctx.concat_javascript(js_path='src/pkjs')

    if ctx.env.TARGET_PLATFORMS:
        for platform in ctx.env.TARGET_PLATFORMS:
            ctx.build_platform(platform, binaries=binaries)

        ctx.pbl_bundle(binaries=binaries,
                       js=js_target)
    else:
        ctx.env.BUILD_DIR = 'aplite'
        ctx.build_platform(binaries=binaries)

        elfs = binaries[0]
        ctx.pbl_bundle(elf=elfs['app_elf'],
                       js=js_target)


@conf
def configure_platform(ctx, platform=None):
    if platform is not None:
        ctx.setenv(platform, ctx.all_envs[platform])


@conf
def build_platform(ctx, platform=None, binaries=None):
    if platform is not None:
        ctx.set_env(ctx.all_envs[platform])

    app_elf = '{}/pebble-app.elf'.format(ctx.env.BUILD_DIR)
    ctx.pbl_program(source=ctx.path.ant_glob('src/**/*.c'),
                    target=app_elf)

    binaries.append({'platform': platform, 'app_elf': app_elf})


@conf
def concat_javascript(ctx, js_path=None):
    js_nodes = (ctx.path.ant_glob(js_path + '/**/*.js') +
                ctx.path.ant_glob(js_path + '/**/*.json'))

    if not js_nodes:
        return []

    def concat_javascript_task(task):
        LOADER_PATH = "loader.js"
        LOADER_TEMPLATE = ("__loader.define({relpath}, {lineno}, " +
                           "function(exports, module, require) {{\n{body}\n}});")
        JSON_TEMPLATE = "module.exports = {body};"

        def loader_translate(source, lineno):
            return LOADER_TEMPLATE.format(
                relpath=json.dumps(source['relpath']),
                lineno=lineno,
                body=source['body'])

        sources = []
        for node in task.inputs:
            relpath = os.path.relpath(node.abspath(), js_path)
            with open(node.abspath(), 'r') as f:
                body = f.read()
                if relpath.endswith('.json'):
                    body = JSON_TEMPLATE.format(body=body)

                if relpath == LOADER_PATH:
                    sources.insert(0, body)
                else:
                    sources.append({'relpath': relpath, 'body': body})

        # Add package.json as a module
        PACKAGE_PATH = "package.json"
        with open(PACKAGE_PATH, 'r') as f:
            body = JSON_TEMPLATE.format(body=f.read())
            sources.append({'relpath': PACKAGE_PATH, 'body': body})

        sources.append('__loader.require("app.js");')

        with open(task.outputs[0].abspath(), 'w') as f:
            lineno = 1
            for source in sources:
                if type(source) is dict:
                    body = loader_translate(source, lineno)
                else:
                    body = source
                f.write(body + '\n')
                lineno += body.count('\n') + 1

    js_target = ctx.path.make_node('build/src/pkjs/pebble-js-app.js')

    ctx(rule=concat_javascript_task,
        source=js_nodes,
        target=js_target)

    return js_target
