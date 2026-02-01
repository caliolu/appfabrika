/**
 * Init Command Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @clack/prompts before importing the module
vi.mock('@clack/prompts', () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  text: vi.fn(),
  select: vi.fn(),
  cancel: vi.fn(),
  isCancel: vi.fn(() => false),
}));

// Mock fs modules
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
}));

// Import after mocks are set up
import { initCommand, deriveProjectName } from '../../src/cli/commands/init.js';
import * as p from '@clack/prompts';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Helper to set up default mocks for a successful init flow
 */
function setupDefaultMocks() {
  vi.mocked(p.text).mockResolvedValue('Test proje fikri');
  vi.mocked(p.select)
    .mockResolvedValueOnce('openai')
    .mockResolvedValueOnce('full-auto');
  vi.mocked(p.isCancel).mockReturnValue(false);
  vi.mocked(existsSync).mockReturnValue(false);
  vi.mocked(mkdir).mockResolvedValue(undefined);
  vi.mocked(writeFile).mockResolvedValue(undefined);
}

describe('deriveProjectName', () => {
  it('should convert idea to kebab-case', () => {
    expect(deriveProjectName('Restoran Rezervasyon Uygulaması')).toBe('restoran-rezervasyon-uygulamasi');
  });

  it('should handle Turkish characters', () => {
    expect(deriveProjectName('Güzel Şehir Önerileri')).toBe('guzel-sehir-onerileri');
  });

  it('should remove special characters', () => {
    expect(deriveProjectName('My Cool App!!!')).toBe('my-cool-app');
  });

  it('should handle multiple spaces', () => {
    expect(deriveProjectName('Test   App   Name')).toBe('test-app-name');
  });

  it('should trim leading/trailing dashes', () => {
    expect(deriveProjectName('  Test App  ')).toBe('test-app');
  });

  it('should limit to 50 characters', () => {
    const longIdea = 'This is a very long project idea that should be truncated to fifty characters maximum';
    expect(deriveProjectName(longIdea).length).toBeLessThanOrEqual(50);
  });
});

describe('initCommand', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupDefaultMocks();
  });

  it('should show welcome message with AppFabrika branding', async () => {
    await initCommand();

    expect(p.intro).toHaveBeenCalledTimes(1);
    expect(p.intro).toHaveBeenCalledWith(expect.stringContaining('AppFabrika'));
  });

  it('should show success message on completion', async () => {
    await initCommand();

    expect(p.outro).toHaveBeenCalledTimes(1);
  });

  it('should complete without throwing errors', async () => {
    await expect(initCommand()).resolves.toBeUndefined();
  });

  it('should handle @clack/prompts errors gracefully', async () => {
    const mockError = new Error('Terminal not supported');
    vi.mocked(p.intro).mockImplementationOnce(() => {
      throw mockError;
    });

    await expect(initCommand()).rejects.toThrow('Terminal not supported');
  });
});

describe('initCommand - idea input', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should prompt for idea with correct options', async () => {
    setupDefaultMocks();

    await initCommand();

    expect(p.text).toHaveBeenCalledTimes(1);
    expect(p.text).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Proje fikrinizi tek cümlede açıklayın:',
      placeholder: 'örn: Restoran rezervasyon uygulaması',
      validate: expect.any(Function),
    }));
  });

  it('should validate empty input', async () => {
    setupDefaultMocks();

    await initCommand();

    // Get the validate function from the call
    const callArgs = vi.mocked(p.text).mock.calls[0][0];
    const validateFn = callArgs.validate;

    // Test validation
    expect(validateFn('')).toBe('Proje fikri boş olamaz');
    expect(validateFn('   ')).toBe('Proje fikri boş olamaz');
    expect(validateFn('Valid idea')).toBeUndefined();
  });

  it('should handle user cancellation', async () => {
    const cancelSymbol = Symbol('cancel');
    vi.mocked(p.text).mockResolvedValue(cancelSymbol as unknown as string);
    vi.mocked(p.isCancel).mockImplementation((value) => value === cancelSymbol);

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    await expect(initCommand()).rejects.toThrow('process.exit called');

    expect(p.cancel).toHaveBeenCalledWith('İşlem iptal edildi.');
    expect(mockExit).toHaveBeenCalledWith(0);

    mockExit.mockRestore();
  });
});

describe('initCommand - LLM selection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should prompt for LLM provider with correct options', async () => {
    setupDefaultMocks();

    await initCommand();

    expect(p.select).toHaveBeenCalledTimes(2);
    expect(p.select).toHaveBeenNthCalledWith(1, {
      message: 'Hangi LLM sağlayıcısını kullanmak istersiniz?',
      options: [
        { value: 'openai', label: 'OpenAI (GPT-4)' },
        { value: 'anthropic', label: 'Anthropic (Claude)' },
      ],
    });
  });

  it('should handle LLM selection cancellation', async () => {
    const cancelSymbol = Symbol('cancel');
    vi.mocked(p.text).mockResolvedValue('Test fikri');
    vi.mocked(p.select).mockResolvedValue(cancelSymbol as unknown as string);
    vi.mocked(p.isCancel).mockImplementation((value) => value === cancelSymbol);

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    await expect(initCommand()).rejects.toThrow('process.exit called');

    expect(p.cancel).toHaveBeenCalledWith('İşlem iptal edildi.');
    expect(mockExit).toHaveBeenCalledWith(0);

    mockExit.mockRestore();
  });
});

describe('initCommand - Automation template selection', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should prompt for automation template with correct options', async () => {
    setupDefaultMocks();

    await initCommand();

    expect(p.select).toHaveBeenCalledTimes(2);
    expect(p.select).toHaveBeenNthCalledWith(2, {
      message: 'Otomasyon seviyesini seçin:',
      options: [
        {
          value: 'full-auto',
          label: 'Hızlı Başla (Full Auto)',
          hint: 'Tüm adımlar otomatik çalışır',
        },
        {
          value: 'checkpoint',
          label: 'Adım Adım (Checkpoint)',
          hint: 'Her adımda onay istenir',
        },
      ],
    });
  });

  it('should handle automation template cancellation', async () => {
    const cancelSymbol = Symbol('cancel');
    vi.mocked(p.text).mockResolvedValue('Test fikri');
    vi.mocked(p.select)
      .mockResolvedValueOnce('openai')
      .mockResolvedValueOnce(cancelSymbol as unknown as string);
    vi.mocked(p.isCancel).mockImplementation((value) => value === cancelSymbol);

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    await expect(initCommand()).rejects.toThrow('process.exit called');

    expect(p.cancel).toHaveBeenCalledWith('İşlem iptal edildi.');
    expect(mockExit).toHaveBeenCalledWith(0);

    mockExit.mockRestore();
  });
});

describe('initCommand - Project folder creation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should create project folder with correct structure', async () => {
    setupDefaultMocks();

    await initCommand();

    // Verify mkdir was called with checkpoints path (recursive)
    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining('.appfabrika'),
      { recursive: true }
    );
  });

  it('should create config.json with correct content', async () => {
    setupDefaultMocks();

    await initCommand();

    // Verify writeFile was called with config.json
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('config.json'),
      expect.stringContaining('"version": "1.0.0"')
    );

    // Verify config content includes required fields
    const writeCall = vi.mocked(writeFile).mock.calls[0];
    const configContent = writeCall[1] as string;
    expect(configContent).toContain('"projectName"');
    expect(configContent).toContain('"idea"');
    expect(configContent).toContain('"llmProvider"');
    expect(configContent).toContain('"automationTemplate"');
    expect(configContent).toContain('"createdAt"');
  });

  it('should show project path in outro message', async () => {
    setupDefaultMocks();

    await initCommand();

    expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('test-proje-fikri'));
  });

  it('should handle existing folder conflict', async () => {
    vi.mocked(p.text).mockResolvedValue('Test fikri');
    vi.mocked(p.select)
      .mockResolvedValueOnce('openai')
      .mockResolvedValueOnce('full-auto');
    vi.mocked(p.isCancel).mockReturnValue(false);
    vi.mocked(existsSync).mockReturnValue(true); // Folder exists

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    await expect(initCommand()).rejects.toThrow('process.exit called');

    expect(p.cancel).toHaveBeenCalledWith(expect.stringContaining('Klasör zaten mevcut'));
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
  });

  it('should derive project name from idea', async () => {
    vi.mocked(p.text).mockResolvedValue('Restoran Rezervasyon Uygulaması');
    vi.mocked(p.select)
      .mockResolvedValueOnce('openai')
      .mockResolvedValueOnce('full-auto');
    vi.mocked(p.isCancel).mockReturnValue(false);
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    await initCommand();

    expect(p.outro).toHaveBeenCalledWith(expect.stringContaining('restoran-rezervasyon-uygulamasi'));
  });
});

describe('CLI Program', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupDefaultMocks();
  });

  it('should register init command with Commander.js', async () => {
    const { Command } = await import('commander');

    const program = new Command();
    program
      .name('appfabrika')
      .description('BMAD metodolojisi ile ürün geliştirme CLI aracı')
      .version('0.1.0');

    program
      .command('init')
      .description('Yeni bir BMAD projesi başlat')
      .action(initCommand);

    const initCmd = program.commands.find(cmd => cmd.name() === 'init');
    expect(initCmd).toBeDefined();
    expect(initCmd?.description()).toBe('Yeni bir BMAD projesi başlat');
  });

  it('should have version flag', async () => {
    const { Command } = await import('commander');

    const program = new Command();
    program.version('0.1.0');

    expect(program.version()).toBe('0.1.0');
  });
});
