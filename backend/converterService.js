const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

/**
 * Finds the appropriate Python executable.
 */
function getPythonExecutable() {
  if (process.env.PYTHON_PATH && fs.existsSync(process.env.PYTHON_PATH)) {
    return process.env.PYTHON_PATH;
  }

  // Check local venv inside backend/converter
  const localVenv = path.join(__dirname, 'converter', 'venv', 'Scripts', 'python.exe');
  if (fs.existsSync(localVenv)) {
    return localVenv;
  }

  // Check existing shared venv
  const sharedVenv = path.join('E:', 'PPTX_to_DOC', 'venv', 'Scripts', 'python.exe');
  if (fs.existsSync(sharedVenv)) {
    return sharedVenv;
  }

  // Default to system python
  return process.platform === 'win32' ? 'python' : 'python3';
}

/**
 * Converts a PPTX presentation to a structured DOCX document using the embedded Python converter.
 * @param {string} inputPath - Absolute or relative path to the PPTX file
 * @param {string} outputPath - Desired output path for the generated DOCX file
 * @param {string} mode - 'intelligent' | 'faithful' | 'executive'
 * @param {string|null} apiKey - Optional Gemini API key
 * @returns {Promise<Object>} Conversion results containing document structure and validation report
 */
async function convertPptxToDocx(inputPath, outputPath, mode = 'intelligent', apiKey = null) {
  return new Promise((resolve, reject) => {
    const pythonExe = getPythonExecutable();
    const scriptPath = path.join(__dirname, 'converter', 'run_converter.py');

    const args = [
      scriptPath,
      '--input', path.resolve(inputPath),
      '--output', path.resolve(outputPath),
      '--mode', mode,
    ];

    if (apiKey) {
      args.push('--api_key', apiKey);
    }

    console.log(`[ConverterService] Running embedded Python converter: ${pythonExe}`);

    const pythonProcess = spawn(pythonExe, args, {
      cwd: __dirname,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
      },
    });

    let stdoutData = '';
    let stderrData = '';

    pythonProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (stderrData.trim()) {
        console.warn(`[ConverterService Warnings/Logs]:\n${stderrData}`);
      }

      const match = stdoutData.match(/===CONVERSION_RESULT_START===([\s\S]*?)===CONVERSION_RESULT_END===/);

      if (match && match[1]) {
        try {
          const result = JSON.parse(match[1].trim());
          if (result.success) {
            return resolve(result);
          } else {
            return reject(new Error(result.error || 'Conversion failed inside Python script.'));
          }
        } catch (jsonErr) {
          return reject(new Error(`Failed to parse conversion JSON: ${jsonErr.message}\nRaw Output: ${stdoutData}`));
        }
      }

      if (code !== 0) {
        return reject(new Error(`Python process exited with code ${code}.\nStderr: ${stderrData}\nStdout: ${stdoutData}`));
      }

      return reject(new Error(`No conversion result markers found in output.\nStdout: ${stdoutData}`));
    });

    pythonProcess.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process (${pythonExe}): ${err.message}`));
    });
  });
}

module.exports = {
  convertPptxToDocx,
  getPythonExecutable,
};
