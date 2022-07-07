const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')
const path = require('path')
const fs = require('fs-extra')
const { getCyfsDir } =require('./tool/utils.js')


module.exports = (env, argv) => {
    console.log('当前 env mode: ', argv.mode)
    if ( argv.mode !== "production" ) {
        require('./tool/initLib.js')
    }
    if ( argv.mode === 'production' ) {
        // 先整体将src目录copy出来
        fs.copySync(path.join(__dirname, 'src'), path.join(__dirname, 'www'))
    }
    const outputPath = argv.mode === 'production'?
        path.join(__dirname, 'www', 'dist') :
        path.join(getCyfsDir(), '/services/runtime/www', 'dist')


    return {
        entry: {
            'objects': './src/js/objects.ts',
            'm_objects': './src/js/mobile/objects.ts',
            'info': './src/js/info.ts',
            'm_info': './src/js/mobile/info.ts',
            'appmanager': './src/js/appmanager.ts',
            'm_appmanager': './src/js/mobile/appmanager.ts',
            'index': './src/js/index.ts',
            'activate': './src/js/activate.ts',
            'show': './src/js/show.ts',
            'm_show': './src/js/mobile/show.ts',
            'tx': './src/js/tx.ts',
            'm_tx': './src/js/mobile/tx.ts',
            'browser': './src/js/browser.ts',
            'm_browser': './src/js/mobile/browser.ts',
            'app_index': './src/js/app/app_index.ts',
            'app_detail': './src/js/app/app_detail.ts',
            'app_installed': './src/js/app/app_installed.ts',
            'localstate': './src/js/localstate.ts',
            'guide': './src/js/guide.ts'
        },
        mode: env.production ? 'production' : 'development',
        // mode: 'development',
        // devtool: 'source-map',
        output: {
            filename: "[name].js",
            path: outputPath,
        },
        devServer: {

        },
        stats: {
            errorDetails: true,
        },
        resolve: {
            extensions: ['.ts', '.js'],
        },
        module: {
            rules: [
                {
                    test: /\.css$/,
                    use: [
                        { loader: 'style-loader', options: { injectType: 'linkTag' } },
                        { loader: 'file-loader' }
                    ]
                },
                {
                    test: /\.ts?$/,
                    loader: 'esbuild-loader',
                    options: {
                        loader: 'ts',
                        // target: 'es2019',
                        target: 'chrome80',
                        tsconfigRaw: require('./tsconfig.json')
                    }
                },
            ],
        },
        plugins: [
            // 这里filename是相对于output的path而言
            new HtmlWebpackPlugin({
                template: './src/guide.html',
                filename: '../guide.html',
                chunks: ['guide']
            }),
            new HtmlWebpackPlugin({
                template: './src/object_browser/objects.html',
                filename: '../object_browser/objects.html',
                chunks: ['objects']
            }),
            new HtmlWebpackPlugin({
                template: './src/info.html',
                filename: '../info.html',
                chunks: ['info']
            }),
            new HtmlWebpackPlugin({
                template: './src/index.html',
                filename: '../index.html',
                chunks: ['index']
            }),
            new HtmlWebpackPlugin({
                template: './src/appmanager.html',
                filename: '../appmanager.html',
                chunks: [ 'app_index' ]
            }),
            new HtmlWebpackPlugin({
                template: './src/activate.html',
                filename: '../activate.html',
                chunks: ['activate']
            }),
            new HtmlWebpackPlugin({
                template: './src/show.html',
                filename: '../show.html',
                chunks: ['show']
            }),
            new HtmlWebpackPlugin({
                template: './src/tx.html',
                filename: '../tx.html',
                chunks: ['tx']
            }),
            new HtmlWebpackPlugin({
                template: './src/browser.html',
                filename: '../browser.html',
                chunks: ['browser']
            }),
            new HtmlWebpackPlugin({
                template: './src/mobile/objects.html',
                filename: '../mobile/objects.html',
                chunks: ['m_objects']
            }),
            new HtmlWebpackPlugin({
                template: './src/mobile/info.html',
                filename: '../mobile/info.html',
                chunks: ['m_info']
            }),
            new HtmlWebpackPlugin({
                template: './src/mobile/show.html',
                filename: '../mobile/show.html',
                chunks: ['m_show']
            }),
            new HtmlWebpackPlugin({
                template: './src/mobile/tx.html',
                filename: '../mobile/tx.html',
                chunks: ['m_tx']
            }),
            new HtmlWebpackPlugin({
                template: './src/mobile/appmanager.html',
                filename: '../mobile/appmanager.html',
                chunks: ['m_appmanager']
            }),
            new HtmlWebpackPlugin({
                template: './src/mobile/browser.html',
                filename: '../mobile/browser.html',
                chunks: ['m_browser']
            }),
            new HtmlWebpackPlugin({
                template: './src/app/app_detail.html',
                filename: '../app/app_detail.html',
                chunks: ['app_detail']
            }),
            new HtmlWebpackPlugin({
                template: './src/app/app_installed.html',
                filename: '../app/app_installed.html',
                chunks: ['app_installed']
            }),
            new HtmlWebpackPlugin({
                template: './src/localstate.html',
                filename: '../localstate.html',
                chunks: ['localstate']
            }),
        ],
        externals: [
            // /cyfs_sdk/,
            function ({ context, request }, callback) {
                if (/cyfs_sdk/.test(request)) {
                    // console.log(request)
                    return callback(null, 'cyfs');
                }
                callback()
            },
            {
                jquery: 'jQuery',
            }
        ]
    }
}

