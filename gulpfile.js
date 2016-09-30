/*!
 * Front-end Development Build Tool - v1.0.0 (2013-09-27)
 * @author Franks.T.D
 * Released under MIT license
 */
/* 加载工具 */
var gulp = require('gulp'),
    argv = require('yargs').argv, //参数
    path = require('path'), //路径
    gulpif = require('gulp-if'), //判断
    clean = require('gulp-clean'), //清理
    del = require('del'), //清理
    runSequence = require('run-sequence'), //控制task顺序执行
    sourcemaps = require('gulp-sourcemaps'), //map
    lazypipe = require('lazypipe'), //分离stream链至工厂
    gutil = require('gulp-util'), //gulp工作打印
    notify = require('gulp-notify'), //gulp工作控制台打印
    sftp = require('gulp-sftp'), //ftp工具
    tap = require('gulp-tap'), //打通管道工具

    /* 监听、浏览器更新 */
    watch = require("gulp-watch"), //监控
    combiner = require('stream-combiner2'), //工作流中监听error
    changed = require('gulp-changed'), //监听变更
    browserSync = require('browser-sync'), //浏览器同步测试工具
    reload = browserSync.reload, //定义重新加载API

    /* 文件处理 */
    vinylPaths = require('vinyl-paths'), //获取路径
    fs = require('fs'), //文件操作
    glob = require('glob'), //匹配
    filter = require("gulp-filter"), //排除文件
    rename = require("gulp-rename"), //文件重命名
    cheerio = require('gulp-cheerio'), //类jquery
    domSrc = require('gulp-dom-src'), //获取文件内src
    md5 = require("gulp-md5-plus"), //MD5文件签名
    rev = require('gulp-rev'), //更改版本名
    jsdoc = require('gulp-jsdoc3'), //自动文档

    /* 压缩 */
    htmlmin = require("gulp-html-minifier"), //html压缩
    uglify = require('gulp-uglify'), //js压缩
    minifycss = require('gulp-clean-css'), //CSS压缩
    imagemin = require('gulp-imagemin'), //图片压缩
    spriter = require('gulp-css-spriter'), //图片合并
    base64 = require('gulp-css-base64'), //base64

    /* 合并 */
    useref = require('gulp-useref'), // html内资源合并
    concat = require('gulp-concat'), //多文件合并
    browserify = require('browserify'), //管理js依赖，JS模块化
    webpack = require('gulp-webpack'), //管理js依赖，JS模块化
    seajsCombo = require('gulp-seajs-combo'), //管理js依赖，JS模块化
    amdOptimize = require("amd-optimize"), //管理js依赖，JS模块化

    /* 编译 */
    less = require('gulp-less'), //编译CSS
    sass = require('gulp-sass'), //编译CSS
    stylus = require('gulp-stylus'), //编译CSS
    coffee = require("gulp-coffee"), //编译JS
    babel = require('gulp-babel'), //编译JS,ES6编译成ES5
    react = require('gulp-react'), //编译JS,React转成JavaScript
    jade = require("gulp-jade"), //编译模板

    /* 测试、检测 */
    jshint = require('gulp-jshint'), //JS语法检测
    stylish = require('jshint-stylish'), //工厂
    mocha = require('gulp-mocha'), // 测试

    /* require业务脚本 */
    toolConfig = require('./config-tool.js'), //自定义配置
    appsConfig = require('./config-apps.js'), //自定义配置
    jsdocConfig = require('./jsdoc.json'), //js文档输出配置
    sftpConfig = require('./sftp.js'), //sftp上传配置
    getFile = require('./file.js'); //文档对象处理

/* 配置改写 */
var conf = appsConfig.conf();
    src = appsConfig.srcDir(),
    srcHtmlPrev = appsConfig.srcHtmlPrev(),
    srcStaticPrev = appsConfig.srcStaticPrev(),
    srcStaticAppsPrev = appsConfig.srcStaticAppsPrev(),
    dist = appsConfig.distDir(),
    distHtmlPrev = appsConfig.distHtmlPrev(),
    distStaticPrev = appsConfig.distStaticPrev(),
    distStaticAppsPrev = appsConfig.distStaticAppsPrev(),
    docName = jsdocConfig.templates.systemName, //doc文档标题
    docInclude = jsdocConfig.source.include, //doc文档需要引入的文件，多文件构成文档
    docExclude = jsdocConfig.source.exclude, //doc文档需要排除的文件
    docOutDir = jsdocConfig.opts.destination; //doc文档输出位置

/* 工厂 */
var useJshint = lazypipe().pipe(jshint).pipe(jshint.reporter, stylish); //js检测工厂

/* help命令 */
gulp.task('help', function() {
    console.log('---参考命令 | 开始---------------------------------------------');
    console.log('');
    console.log(' gulp server -d            开启开发server（可无参）');
    console.log('');
    console.log(' gulp server -p            开启生产server');
    console.log('');
    console.log(' gulp compile          编译所有toolConfig.compile中的文档至同目录下，需手动移至上级目录');
    console.log('');
    console.log(' gulp build            构建全部应用至dist目录');
    console.log('');
    console.log(' gulp build -combo -app appName/all  构建部分应用至dist目录，-combo是否开启合并压缩，-app后接应用名或all');
    console.log('');
    console.log(' gulp upload -dir src/dist  上传目录至ftp服务器，-dir后接src或dist');
    console.log('');
    console.log(' gulp clean            删除dist目录');
    console.log('');
    console.log('---参考命令 | 结束---------------------------------------------');
});

/* 设置空白命令和default为server启动命令 */
gulp.task('default', ['server']);

/* 清空所有dist目录 */
gulp.task('clean', function() {
    return del(['./' + dist.dir]);
});

/*自动监听检查JS*/
gulp.task('autoJshint', function() {
    return watch.autoJshint();
});

/*自动监听编译模板*/
gulp.task('autoCompile', function() {
    return watch.autoCompile();
});

/* 命令编译模板 */
gulp.task('compile', function() {
    var app = argv.m || 'all';
    return manual.compile(app);
});

/* 命令运行测试 */
gulp.task('test', function() {
    var app = argv.m || 'all';
    return manual.test(app);
});

/*启动服务 (2016-6-20 9:31测试通过)*/
gulp.task('server', ['autoCompile', 'autoJshint'], function() {
    var evr = argv.d || !argv.p, //开发环境为true，生产环境为false，默认为true
        dir = conf.distDir,
        port = conf.distPort,
        domain = conf.distDomain;
    if (evr) {
        dir = conf.srcDir;
        port = conf.srcPort;
        domain = conf.srcDomain;
    }
    browserSync({
        files: dir + "/**",
        notify: false,
        reloadDelay: toolConfig.reloadDelay,
        ui: { //browserSync的设置ui界面
            port: 9999,
            weinre: {
                port: 9999
            }
        },
        proxy: domain, //使用本地代理服务
        port: port
    });
});

/* 上传至ftp */
gulp.task('upload', function () {
    var dir = argv.dir || 'src',
        _src;
    if(dir === 'src'){
        _src = src+'/';
        remotePath = sftpConfig.srcRemotePath;
    }else if(dir === 'dist'){
        _src = dist+'/';
        remotePath = sftpConfig.distRemotePath;
    }
    return gulp.src( _src + '/**' )
        .pipe(sftp({
            host: sftpConfig.host,
            user: sftpConfig.user,
            port: sftpConfig.port,
            pass: sftpConfig.pass,
            remotePath: remotePath
        }));
});

/* build命令 */
gulp.task('build', function() {
    var app = argv.m || 'all',
        parts = appsConfig.getApp(app);
    for (var key in parts) { //转为线性执行
        (function(key) {
            console.log('');
            console.log('┌-------------------构建“' + parts[key] + '”模块 | 开始------------------------┐');
            console.log('');
            var appItem = parts[key];
            gulp.task('delDir', function() {
                console.log(' 删除 “' + './' + distHtmlPrev + '/' + appItem, '和 ./' + distStaticAppsPrev + '/' + appItem + '” 结束');
                return gulp.src(['./' + distHtmlPrev + '/' + appItem, './' + distStaticAppsPrev + '/' + appItem]).pipe(clean());
            });
            gulp.task(appItem + '_mini_html', function() {
                return mini.html(appItem);
            });
            gulp.task(appItem + '_mini_css', function() {
                return mini.css(appItem);
            });
            gulp.task(appItem + '_mini_js', function() {
                return mini.js(appItem);
            });
            gulp.task(appItem + '_html', function() {
                return build.html(appItem);
            });
            gulp.task(appItem + '_static', function() {
                return build.static(appItem);
            });
            gulp.task(appItem + '_module', function(cb) {
                if (conf.mini) { //构建生产压缩版本
                    runSequence(
                        'delDir', appItem + '_mini_html', appItem + '_res', appItem + '_mini_css', appItem + '_mini_js', cb
                    );
                } else { //构建生产版本
                    runSequence(
                        'delDir', appItem + '_html', appItem + '_static', cb
                    );
                }
            })
            gulp.start(modItem + '_module');
            console.log(' 重新构建 “' + parts[key] + '” 结束');
            console.log('');
            console.log('└--------------------------------------------------------------------┘');
            console.log('');
        })(key);
    }
});

/* static命令：构建src/static至dist/static中 (2016-6-23 8:23测试通过)*/
gulp.task('static', function() {
    var _src = srcStaticPrev + '/**/*.*',
        _dist = distStaticPrev + '/';
    gulp.task('delStatic', function() { //先对dist/static清除
        return gulp.src(_dist, { read: false }).pipe(clean());
    });
    gulp.task('static_res', function() { //复制生成，这里会连带生成apps下的业务脚本，但在整体打包时会删除重新生成。
        gulp.src(_src)
            .pipe(gulpif('*.js' && conf.jshint, useJshint())) //根据dist.jshint配置开启关闭JS检查
            .pipe(gulpif('*.{jpg,jpeg,png,gif}', imagemin())) //如果是图片，则进行压缩 
            .pipe(gulp.dest(_dist));
    });
    runSequence( //执行task:static命令下任务
        'delStatic', 'static_res'
    );
});
/* 构建生产版本 */
var build = {
    //构建html(2016-6-22 17:43测试通过,demo页：html/o2o/product-list.html)
    html: function() {
        var app = arguments[0],
            _src = srcHtmlPrev + '/' + app + '/**/' + toolConfig.html,
            _dist = distHtmlPrev + '/' + app;
        var combined = combiner.obj([
            gulp.src(_src),
            cheerio(function($, file) { //进入.html文件
                var filePath = file.path, //获取的当前文档物理路径
                    linkDom = $('link'),
                    scriptDom = $('script'),
                    imgDom = $('img');
                //插入构建时间
                $('body').eq(0).before(toolConfig.buildInfo);
                //修改CSS路径
                $('link').each(function(index, el) {
                    var $el = $(this),
                        href = $el.attr('href'),
                        rel = $el.attr('rel');
                    if (href) {
                        if (/icon/ig.test(rel) || rel === 'stylesheet') {
                            $el.attr('href', getFile.changePath(href, filePath));
                        }
                    }
                });
                //修改js路径
                $('script').each(function(index, el) {
                    var $el = $(this),
                        href = $el.attr('src');
                    if (href) {
                        $el.attr('src', getFile.changePath(href, filePath));
                    }
                });
                //修改img路径
                $('img').each(function(index, el) {
                    var $el = $(this),
                        href = $el.attr('src');
                    if (href) {
                        $el.attr('src', getFile.changePath(href, filePath));
                    }
                    //修改以"data-*"标签的图片
                    for(var key in toolConfig.img){
                        (function(key) {
                            var dataImg = $el.data(toolConfig.img[key]);
                            if (dataImg !== undefined && dataImg !== '') {
                                $el.attr('data-' + toolConfig.img[key], getFile.changePath(dataImg, filePath))
                            }
                        })(key);
                    }
                });
                //修改在html中以style方式写入的背景图片，节点需要加入“background-image”
                $(toolConfig.backgroundImg).each(function(index, el) {
                    var $el = $(this),
                        imgHref = $el.css('background-image'),
                        arr = ["url(",")","/'/g"];
                    for(var j = 0; j < 3; j++){ //格式化
                        imgHref = href.replace(arr[j],'');
                    }
                    $el.css('background-image', "url(" + getFile.changePath(imgHref, filePath) + ")");
                });

                /*
                //修改CSS路径
                for(var i = 0, l = linkDom.length; i < l; i++){
                    var item = linkDom.eq(i),
                        href = item.attr('href'),
                        rel = item.attr('rel');
                    if (href && (/icon/ig.test(rel) || rel === 'stylesheet')) {
                        item.attr('href', getFile.changePath(href, filePath));
                    }
                };
                //修改js路径
                for(var i = 0, l = scriptDom.length; i < l; i++){
                    var item = scriptDom.eq(i),
                        href = item.attr('src');
                    if (href) {
                        item.attr('src', getFile.changePath(href, filePath));
                    }
                };
                //修改img路径
                for(var i = 0, l = imgDom.length; i < l; i++){
                    var item = imgDom.eq(i),
                        href = item.attr('src');
                    if (href) {
                        item.attr('src', getFile.changePath(href, filePath));
                    }
                    //修改以"data-*"标签的图片
                    for(var key in toolConfig.img){
                        (function(key) {
                            var dataImg = $el.data(toolConfig.img[key]);
                            if (dataImg !== undefined && dataImg !== '') {
                                $el.attr('data-' + toolConfig.img[key], getFile.changePath(dataImg, filePath))
                            }
                        })(key);
                    }
                };
                //修改在html中以style方式写入的背景图片，节点需要加入“background-image”
                for(var i = 0, l = backgroundImgDom.length; i < l; i++){
                    var item = backgroundImgDom.eq(i),
                        href = item.css('background-image'),
                        arr = ["url(",")","/'/g"];
                    for(var j = 0; j < 3; j++){ //格式化
                        href = href.replace(arr[j],'');
                    }
                    item.css('background-image', "url(" + getFile.changePath(imgHref, filePath) + ")");
                };*/


            }),
            gulp.dest(_dist)
        ]);
        combined.on('error', console.error.bind(console));
        return combined;
    },
    //构建资源
    static: function() {
        var res = toolConfig.res,
            app = arguments[0],
            staticA = srcStaticPrev + '/' + srcStaticAppsPrev + '/' + app, //static下的资源
            staticB = srcHtmlPrev + '/' + app, //业务模块下的资源
            arr = [staticA, staticB];
        for (var key in arr) {
            (function(key) {
                var thisR = rArr[key];
                for (var k in res) {
                    (function(k) {
                        var item = res[k].split('/'),
                            _src = thisR + '/**/' + item[1];
                        if (item[1].indexOf('js') !== -1 || item[1].indexOf('css') !== -1) {
                            _src = thisR + '/**/*.' + item[0];
                        }
                        gulp.src(_src)
                            .pipe(gulpif('*.js' && dist.jshint, useJshint()))
                            .pipe(gulpif('*.{jpg,jpeg,png,gif}', imagemin()))
                            .pipe(gulp.dest(distStaticPrev + '/' + conf.appDir + '/' + app + '/'));
                    })(k)
                }
            })(key)
        }
    },
    //webpack构建JS
    jsWebpck: function() {
        var entries = function(globPath) {
            var files = glob.sync(globPath),
                entries = {},
                entry,
                dirname,
                basename;
            for (var i = 0; i < files.length; i++) {
                entry = files[i];
                dirname = path.dirname(entry);
                basename = path.basename(entry, '.js');
                entries[path.join(dirname, basename)] = './' + entry;
            }
            return entries;
        };
        var key = arguments[0],
            s = srcHtmlPrev + '/' + key;
        if (arguments[0] === undefined) {
            var key = src.staticDir,
                s = srcStaticPrev;
        }
        var _dist = distStaticPrev + '/' + key + '/',
            _src = s + '/**/' + src.js;
        var combined = combiner.obj([
            gulp.src(_src),
            webpack({
                entry: entries(_src),
                output: {
                    path: path.join(__dirname, _dist),
                    filename: '[name].js'
                }
            }, null, function(err, stats) {
                if (err) throw new gutil.PluginError("webpack", err);
                console.log("[webpack]", 'webpack is work!');
            }),
            gulp.dest(_dist), //转移至dist目录下保存
            uglify(), //混淆
            gulp.dest(_dist + '/min/') //输出混淆版本保存
        ]);
        combined.on('error', console.error.bind(console));
        return combined;
    }
}
var combo = {
        amd: function() {

        },
        cmd: function() {

        },
        webpack: function() {

        }
    }
    /*构建mini版本*/
var mini = {
    html: function() {
        var userTime = function() {
            var myDate = new Date(),
                year = myDate.getFullYear(),
                month = myDate.getMonth() + 1,
                day = myDate.getDate(),
                hours = myDate.getHours(),
                minutes = myDate.getMinutes(),
                second = myDate.getSeconds();
            return year + month + day + hours + minutes + second;
        }
        var staticDomain = appsConfig.hasDistStaticDomain() ? '/' + conf.distStaticDomain : conf.distStaticDir;
        var key = arguments[0],
            _dist = distHtmlPrev + '/' + key,
            _src = srcHtmlPrev + '/' + key;
        var combined = combiner.obj([
            gulp.src(_src + '/' + toolConfig.html),
            cheerio(function($, file) { //进入html文件
                var pageRoot = file.path, //获取html路径
                    pageName = getFile.name(pageRoot);
                //动作一：改写标题
                $('title').html(conf.title + $('title').html());

                /*动作二：检查资源引入句子*/
                var k = true;

                function eachMsg() { //如果引用的为绝对路径
                    var src = arguments[0];
                    if (src[0] === '/' && src[1] != '/') {
                        k = false;
                        console.log('');
                        console.log('┌-------------------错误！！！！！！------------------------┐');
                        console.log('');
                        console.log('"' + getFile.name(pageRoot) + '"中"' + src + '"为绝对路径引用，请改为相对路径！')
                        console.log('');
                        console.log('└-----------------------------------------------------------┘');
                        console.log('');
                    }
                }
                $('link', 'script').each(function(index, el) {
                    var $el = $(this),
                        href = $el.attr('href'),
                        rel = $el.attr('rel'),
                        src = $el.attr('src');
                    if (href) {
                        if (/icon/ig.test(rel) || rel === 'stylesheet') { //排除非CSS引入句子
                            eachMsg(href);
                            return false;
                        }
                    }
                    if (src) {
                        eachMsg(href);
                        return false;
                    }
                });
                /*动作三：合并资源文件*/
                if (k) {
                    var res = src.res,
                        path = getFile.modDir(pageRoot);
                    for (var key in res) {
                        (function(key) {
                            var item = res[key];
                            //css合并、css中图片合并
                            if (item.indexOf('css') > -1) {
                                var imgDir = 'img',
                                    cssArr = item.split('/');
                                var cssDir = cssArr[0];
                                for (var i in res) {
                                    (function(i) {
                                        var that = res[i];
                                        if (that.indexOf('jpg') > -1 || that.indexOf('jpeg') > -1 || that.indexOf('png') > -1 || that.indexOf('gif') > -1) {
                                            var imgArr = that.split('/'),
                                                imgDir = imgArr[0];
                                        }
                                    })
                                }
                                var _dist2 = distStaticPrev + '/' + conf.appDir + '/' + path + '/' + cssDir + '/min/';
                                domSrc({ // 本组件会自动忽略以绝对方式引入的资源文件，所以会排除以域方式或cdn方式的或"/"开头或"//"开头
                                        file: pageRoot,
                                        selector: 'link',
                                        attribute: 'href'
                                    })
                                    .pipe(concat(pageName + '.css'))
                                    .pipe(spriter({
                                        spriteSheet: distStaticPrev + '/' + conf.appDir + '/' + path + '/' + imgDir + '/min/sprite_' + userTime() + '.png',
                                        pathToSpriteSheetFromCSS: '../' + imgArr[0] + '/min/sprite_' + userTime() + '.png',
                                        spritesmithOptions: {
                                            padding: 5
                                        }
                                    }))
                                    .pipe(minifycss())
                                    .pipe(gulp.dest(_dist2));
                                $('link').each(function(index, el) {
                                    var $el = $(this),
                                        src = $el.attr('href'),
                                        rel = $el.attr('rel');
                                    if (src) {
                                        if (/icon/ig.test(rel) || rel === 'stylesheet') { //排除非CSS引入句子
                                            if (src.substring(0, 4) != 'http' && src.substring(0, 2) != '//') {
                                                $el.remove();
                                            }
                                        }
                                    }
                                });
                            }
                            if (item.indexOf('js') > -1) {
                                var jsArr = item.split('/');
                                var jsDir = jsArr[0];
                                var _dist2 = distStaticPrev + '/' + conf.appDir + '/' + path + '/' + jsDir + '/min/';
                                domSrc({ // 本组件会自动忽略以绝对方式引入的资源文件，所以会排除以域方式或cdn方式的
                                        file: pageRoot,
                                        selector: 'script',
                                        attribute: 'src'
                                    })
                                    .pipe(concat(pageName + '.js'))
                                    .pipe(uglify())
                                    .pipe(gulp.dest(_dist2));
                                $('script').each(function(index, el) {
                                    var $el = $(this),
                                        src = $el.attr('src');
                                    if (src) {
                                        if (src.substring(0, 4) != 'http' && src.substring(0, 2) != '//') {
                                            $el.remove();
                                        }
                                    }
                                });
                            }
                        })(key);
                    }
                    //删除原有资源引入句子
                    $('link', 'script').each(function(index, el) {
                        var $el = $(this),
                            href = $el.attr('href'),
                            rel = $el.attr('rel'),
                            src = $el.attr('src');
                        var cssBoolean = function() {
                            var x = /icon/ig.test(rel) || rel === 'stylesheet';
                            return href && x;
                        }
                        if (src || cssBoolean) {
                            if (src.substring(0, 4) != 'http' && src.substring(0, 2) != '//') {
                                $el.remove();
                            }
                        }
                    });
                    //动作四 加入构建后的CSS和JS引入句子
                    $('head').append('<link rel="stylesheet" href="' + staticDomain + '/' + conf.appDir + '/' + path + '/' + cssArr[0] + '/min/' + pageName + '.css?v=' + userTime() + '">');
                    $('body').append('<script src="' + staticDomain + '/' + conf.appDir + '/' + path + '/' + jsArr[0] + '/min/' + pageName + +'.js?v=' + userTime() + '"></script>');
                }
            }),
            htmlmin({
                minifyCSS: true,
                minifyJS: true,
                collapseWhitespace: true,
                removeComments: true //清除注释
            }),
            gulp.dest(_dist)
        ]);
        combined.on('error', console.error.bind(console));
        return combined;
    },
    //构建mini-Js
    js: function() {
        var entries = function(globPath) {
            var files = glob.sync(globPath),
                entries = {},
                entry,
                dirname,
                basename;
            for (var i = 0; i < files.length; i++) {
                entry = files[i];
                dirname = path.dirname(entry);
                basename = path.basename(entry, '.js');
                entries[path.join(dirname, basename)] = './' + entry;
            }
            return entries;
        };
        var isJs = function() {
            var paths = arguments[0],
                suffix = getFile.suffix(paths);
            if (suffix === 'js') {
                return true;
            } else {
                return false;
            }
        };
        var byAMD = function() {
            var paths = arguments[0];
            var c = function() {
                if (conf.moduleCombo === 'amd') {
                    return true;
                }
            }
            return isJs(paths) && c;
        };
        var byCMD = function() {
            var paths = arguments[0];
            var c = function() {
                if (conf.moduleCombo === 'cmd') {
                    return true;
                }
            }
            return isJs(paths) && c;
        };
        var byWebpack = function() {
            var paths = arguments[0];
            var c = function() {
                if (conf.moduleCombo === 'webpack') {
                    return true;
                }
            }
            return isJs(paths) && c;
        };
        var key = arguments[0],
            _dist = distStaticPrev + '/' + conf.appDir + '/' + key + '/',
            _src = srcHtmlPrev + '/' + key + '/**/*.js';
        var combined = combiner.obj([
            gulp.src(_src),
            gulpif(dist.jshint, useJshint()),
            uglify(),
            //bySeajs
            rename(function(path) {
                path.dirname += "/min";
            }),
            gulp.dest(_dist)
        ]);
        combined.on('error', console.error.bind(console));
        return combined;
    },
    //构建mini-css
    css: function() {
        var key = arguments[0],
            _dist = distStaticPrev + '/' + conf.appDir + '/' + key + '/',
            _src = srcHtmlPrev + '/' + key + '/**/*.css';
        var res = src.res,
            imgDir = 'img',
            timestamp = +new Date();
        for (var i in res) {
            (function(i) {
                var that = res[i];
                if (that.indexOf('jpg') > -1 || that.indexOf('jpeg') > -1 || that.indexOf('png') > -1 || that.indexOf('gif') > -1) {
                    var imgArr = that.split('/'),
                        imgDir = imgArr[0];
                }
            })
        }
        var combined = combiner.obj([
            gulp.src(_src),
            vinylPaths(function(paths) {
                gulp.src(paths)
                    .pipe(spriter({
                        spriteSheet: distStaticPrev + '/' + conf.appDir + '/' + key + '/' + getFile.modDir(paths) + '/' + imgDir + '/min/sprite_' + timestamp + '.png',
                        pathToSpriteSheetFromCSS: '../' + imgDir + '/min/sprite_' + timestamp + '.png',
                        spritesmithOptions: {
                            padding: 5
                        }
                    }))
                return Promise.resolve();
            }),
            minifycss(),
            rename(function(path) {
                path.dirname += "/min";
            }),
            gulp.dest(_dist)
        ]);
        combined.on('error', console.error.bind(console));
        return combined;
    }
}

/* 监听 */
var watch = {
    //自动监听检测JS代码、文档生成 (2016-9-19 14:40测试通过)
    autoJshint: function() {
        gulp.watch(src.dir + '/**/*.js', function(event) {
            if (event.type === 'changed') {
                var _src = event.path;
                var docsDir = conf.docsDir;
                if (src.jsdoc) {
                    delete[docName, docInclude, docExclude, docOutDir];
                    jsdocConfig.templates.systemName = getFile.newSrc(_src) + "-说明文档";
                    jsdocConfig.opts.destination = "./" + docsDir + "/" + getFile.modDir(_src) + "/" + getFile.name(_src);
                    del(['./' + docsDir + '/' + getFile.modDir(_src) + '/' + getFile.name(_src)]);
                };
                gulp.src(_src)
                    .pipe(gulpif(src.jshint, useJshint()))
                    .pipe(gulpif(src.jsdoc, jsdoc(jsdocConfig)));
            } else {
                return false;
            }

        });
    },
    //自动监听编译模板 (2016-9-9 16:05测试通过)
    autoCompile: function() {
        var x = src.compile;
        for (var k in x) {
            gulp.watch(src.dir + '/**/' + x[k].path, function(event) {
                var _src = event.path,
                    fileMod = getFile.modDir(_src),
                    fileName = getFile.name(_src),
                    suffix = getFile.suffix(_src),
                    tool = eval('src.compile.' + suffix + '.tool'),
                    dest = src.dir + '/' + fileMod;
                console.log('');
                console.log('---自动编译 | 开始---------------------------------------------');
                console.log('');
                if (fileName[0] === '_') {
                    _src = getFile.dir(_src) + '!(_)*.' + suffix;
                    console.log(' **您修改的文件为公共文件**');
                }
                console.log('使用"' + tool + '"自动编译"' + _src + '"');
                console.log('');
                console.log('编译文件位于："' + dest + '"目录');
                console.log('');
                console.log('---自动编译 | 结束---------------------------------------------');
                console.log('');
                var combined = combiner.obj([
                    gulp.src(_src),
                    gulpif('*.' + suffix, eval(tool)),
                    gulp.dest(dest)
                ]);
                combined.on('error', console.error.bind(console));
                return combined;
            })
        }
    }
}

/* 部分手动命令 */
var manual = {
    //手动命令编译模板(2016-6-21 11:26测试通过)
    compile: function() {
        var mod = arguments[0],
            x = src.compile,
            parts = [];
        parts = this.getApp(mod);
        for (var key in parts) {
            (function(key) {
                for (var k in x) {
                    (function(k) {
                        var _src = x[k].path,
                            fileName = getFile.name(_src),
                            suffix = getFile.suffix(_src),
                            tool = eval('src.compile.' + suffix + '.tool');
                        console.log('');
                        console.log('---自动编译 | 开始---------------------------------------------');
                        console.log('');
                        console.log('使用"' + tool + '"自动编译所有"' + srcHtmlPrev + '/' + parts[key] + '/**/*.' + suffix + '"');
                        console.log('');
                        console.log('编译文件位于："' + suffix + '"文件的同目录下');
                        console.log('');
                        console.log('---自动编译 | 结束---------------------------------------------');
                        console.log('');
                        gulp.src(srcHtmlPrev + '/' + parts[key] + '/**/*.' + suffix)
                            .pipe(gulpif('*.' + suffix, eval(tool)))
                            .pipe(gulp.dest(srcHtmlPrev + '/' + parts[key] + '/'));
                        gulp.src(srcStaticPrev + '/' + conf.appDir + '/' + parts[key] + '/**/*.' + suffix)
                            .pipe(gulpif('*.' + suffix, eval(tool)))
                            .pipe(gulp.dest(srcStaticPrev + '/' + conf.appDir + '/' + parts[key] + '/'));
                    })(k);
                }
            })(key);
        }
    },

    //模块形式测试
    test: function() {
        var mod = arguments[0],
            x = src.compile,
            parts = [];
        parts = this.getApp(mod);
        for (var key in parts) {
            (function(key) {
                gulp.src('test/' + parts[key] + '/**/*.js', { read: false })
                    .pipe(mocha({ reporter: 'nyan' }))
                    .on('error', gutil.log);
            })(key);
        }
    }
}
