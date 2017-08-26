
/**
Definition of the HtmlPdfCLIGenerator class.
@module generators/html-pdf-generator.js
@license MIT. See LICENSE.md for details.
 */

(function() {
  var FS, HMSTATUS, HTMLPDF, HtmlPdfCLIGenerator, PATH, SLASH, SPAWN, TemplateGenerator, _, engines,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  TemplateGenerator = require('./template-generator');

  FS = require('fs-extra');

  PATH = require('path');

  SLASH = require('slash');

  _ = require('underscore');

  HMSTATUS = require('../core/status-codes');

  SPAWN = require('../utils/safe-spawn');

  HTMLPDF = require('puppeteer');


  /**
  An HTML-driven PDF resume generator for HackMyResume. Talks to Phantom,
  wkhtmltopdf, and other PDF engines over a CLI (command-line interface).
  If an engine isn't installed for a particular platform, error out gracefully.
   */

  module.exports = HtmlPdfCLIGenerator = (function(superClass) {
    extend(HtmlPdfCLIGenerator, superClass);

    function HtmlPdfCLIGenerator() {
      HtmlPdfCLIGenerator.__super__.constructor.call(this, 'pdf', 'html');
    }


    /** Generate the binary PDF. */

    HtmlPdfCLIGenerator.prototype.onBeforeSave = function(info) {
      var safe_eng;
      if (info.ext !== 'html' && info.ext !== 'pdf') {
        return info.mk;
      }
      safe_eng = info.opts.pdf || 'wkhtmltopdf';
      if (safe_eng === 'phantom') {
        safe_eng = 'phantomjs';
      }
      if (_.has(engines, safe_eng)) {
        this.errHandler = info.opts.errHandler;
        engines[safe_eng].call(this, info.mk, info.outputFile, info.opts, this.onError);
        return null;
      }
    };


    /* Low-level error callback for spawn(). May be called after HMR process
    termination, so object references may not be valid here. That's okay; if
    the references are invalid, the error was already logged. We could use
    spawn-watch here but that causes issues on legacy Node.js.
     */

    HtmlPdfCLIGenerator.prototype.onError = function(ex, param) {
      var ref;
      if ((ref = param.errHandler) != null) {
        if (typeof ref.err === "function") {
          ref.err(HMSTATUS.pdfGeneration, ex);
        }
      }
    };

    return HtmlPdfCLIGenerator;

  })(TemplateGenerator);

  engines = {

    /**
    Generate a PDF from HTML using wkhtmltopdf's CLI interface.
    Spawns a child process with `wkhtmltopdf <source> <target>`. wkhtmltopdf
    must be installed and path-accessible.
    TODO: If HTML generation has run, reuse that output
    TODO: Local web server to ease wkhtmltopdf rendering
     */
    wkhtmltopdf: function(markup, fOut, opts, on_error) {
      var tempFile, wkhtmltopdf_args, wkhtmltopdf_options;
      tempFile = fOut.replace(/\.pdf$/i, '.pdf.html');
      FS.writeFileSync(tempFile, markup, 'utf8');
      wkhtmltopdf_options = _.extend({
        'margin-bottom': '10mm',
        'margin-top': '10mm'
      }, opts.wkhtmltopdf);
      wkhtmltopdf_options = _.flatten(_.map(wkhtmltopdf_options, function(v, k) {
        return ['--' + k, v];
      }));
      wkhtmltopdf_args = wkhtmltopdf_options.concat([tempFile, fOut]);
      SPAWN('wkhtmltopdf', wkhtmltopdf_args, false, on_error, this);
    },

    /**
    Generate a PDF from HTML using Phantom's CLI interface.
    Spawns a child process with `phantomjs <script> <source> <target>`. Phantom
    must be installed and path-accessible.
    TODO: If HTML generation has run, reuse that output
    TODO: Local web server to ease Phantom rendering
     */
    phantomjs: function(markup, fOut, opts, on_error) {
      var destPath, scriptPath, sourcePath, tempFile;
      tempFile = fOut.replace(/\.pdf$/i, '.pdf.html');
      FS.writeFileSync(tempFile, markup, 'utf8');
      scriptPath = PATH.relative(process.cwd(), PATH.resolve(__dirname, '../utils/rasterize.js'));
      scriptPath = SLASH(scriptPath);
      sourcePath = SLASH(PATH.relative(process.cwd(), tempFile));
      destPath = SLASH(PATH.relative(process.cwd(), fOut));
      SPAWN('phantomjs', [scriptPath, sourcePath, destPath], false, on_error, this);
    },

    /**
    Generate a PDF from HTML using WeasyPrint's CLI interface.
    Spawns a child process with `weasyprint <source> <target>`. Weasy Print
    must be installed and path-accessible.
    TODO: If HTML generation has run, reuse that output
     */
    weasyprint: function(markup, fOut, opts, on_error) {
      var tempFile;
      tempFile = fOut.replace(/\.pdf$/i, '.pdf.html');
      FS.writeFileSync(tempFile, markup, 'utf8');
      SPAWN('weasyprint', [tempFile, fOut], false, on_error, this);
    },

    /**
    Generate a PDF from HTML using headless google chome (v59 or newer).
    Google Chrome must be installed and path-accessible.
     */
    chrome: function(markup, fOut, opts, on_error) {
      var chrome_launch_options, chrome_pdf_options, tempFile;
      chrome_launch_options = _.extend({}, opts.chrome.launch);
      chrome_pdf_options = _.extend({
        'path': fOut,
        'landscape': false,
        'displayHeaderFooter': false,
        'printBackground': false,
        'format': "A4",
        'scale': 1,
        'width': '8.5in',
        'height': '11in',
        'pageRanges': '',
        'margin': {
          'top': '0.4in',
          'bottom': '0.56in',
          'left': '0.4in',
          'right': ' 0.4in'
        }
      }, opts.chrome.pdf);
      tempFile = fOut.replace(/\.pdf$/i, '.pdf.html');
      FS.writeFileSync(tempFile, markup, 'utf8');
      HTMLPDF.launch(chrome_launch_options).then(function(browser) {
        return browser.newPage().then(function(page) {
          return page.goto('file://' + tempFile, {
            waitUntil: 'networkidle'
          }).then(function(response) {
            return page.pdf(chrome_pdf_options).then(function(buffer) {
              return browser.close();
            });
          });
        });
      });
    }
  };

}).call(this);

//# sourceMappingURL=html-pdf-cli-generator.js.map
