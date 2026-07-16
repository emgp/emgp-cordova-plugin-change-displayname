#!/usr/bin/env node

var fs = require('fs');
var path = require("path");
var xml2js = require('xml2js');
var parser = new xml2js.Parser();
var semver = require('semver');
var builder = new xml2js.Builder({
    xmldec: {
        version: '1.0',
        encoding: 'UTF-8'
    }
});

module.exports = function (context) {

    if(context.opts.platforms.indexOf('android') === -1) return;

    console.log('Attempting to set app name for android');
    
    //var projectRoot = context.opts.projectRoot;
    var projectRoot = context.opts.projectRoot || process.cwd();
    console.log(`projectRoot ${projectRoot}`);

    if (typeof projectRoot !== 'string') {
        console.error('Erro: projectRoot inválido. Abortando.');
        return;
    }
    
    const usesNewStructure = fs.existsSync(path.join(projectRoot, 'platforms', 'android', 'app'));
    console.log('usesNewStructure:', usesNewStructure);

    const basePath = usesNewStructure 
        ? path.join(projectRoot, 'platforms', 'android', 'app', 'src', 'main') 
        : path.join(projectRoot, 'platforms', 'android');
    console.log('basePath:', basePath);

    var configPath = path.join(basePath, 'res', 'xml', 'config.xml');
    console.log('configPath:', configPath);

    var stringsPath = path.join(basePath, 'res', 'values', 'cdv_strings.xml');
    if (!fs.existsSync(stringsPath)) {
        stringsPath = path.join(basePath, 'res', 'values', 'strings.xml');
    }
    console.log('stringsPath:', stringsPath);
    // make sure the android config file exists
    try {
        fs.accessSync(configPath, fs.F_OK);
    } catch(e) {
        console.error(`Could not find android config.xml at ${configPath}`);
        return;
    }

    var name;
    try {
        name = getConfigParser(context, configPath).getPreference('AppName');
    } catch(e) {
        console.error('Error parsing config.xml for AppName preference:', e);
        return;
    }

    if (name) {
        var stringsXml;
        try {
            if (!fs.existsSync(stringsPath)) {
                console.warn(`Warning: Neither cdv_strings.xml nor strings.xml found at ${stringsPath}. Skipping name update.`);
                return;
            }
            stringsXml = fs.readFileSync(stringsPath, 'UTF-8');
        } catch(e) {
            console.error(`Error reading strings file at ${stringsPath}:`, e);
            return;
        }

        parser.parseString(stringsXml, function (err, data) {
            if (err) {
                console.error('Error parsing XML data:', err);
                return;
            }

            if (data && data.resources && data.resources.string) {
                data.resources.string.forEach(function (string) {
                    if (string.$ && (string.$.name === 'app_name' || string.$.name === 'launcher_name')) {
                        console.log('Setting App Name to: ', name);
                        string._ = name;
                    }
                });

                try {
                    fs.writeFileSync(stringsPath, builder.buildObject(data));
                } catch(e) {
                    console.error(`Error writing updated XML to ${stringsPath}:`, e);
                }
            }
        });
    }
};

function getConfigParser(context, config) {
    var ConfigParser;
    try {
        if (semver.lt(context.opts.cordova.version, '5.4.0')) {
            ConfigParser = context.requireCordovaModule('cordova-lib/src/ConfigParser/ConfigParser');
        } else {
            ConfigParser = context.requireCordovaModule('cordova-common/src/ConfigParser/ConfigParser');
        }
    } catch (e) {
        // Fallback seguro se requireCordovaModule falhar em ambientes estritos
        ConfigParser = require('cordova-common').ConfigParser;
    }

    return new ConfigParser(config);
}