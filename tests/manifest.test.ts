import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const manifest = JSON.parse(
  readFileSync(fileURLToPath(new URL('../manifest.json', import.meta.url)), 'utf8'),
) as { tools: Array<{ name: string; description: string }> };

function describeTool(name: string): string {
  const tool = manifest.tools.find((t) => t.name === name);
  if (!tool) throw new Error(`manifest.json lists no ${name}`);
  return tool.description;
}

describe('manifest.json tool descriptions', () => {
  // WorklogSearchInput has no team or account filter (those live on
  // tempo_get_worklogs_by_team / _by_account), so the directory listing must
  // not advertise them.
  it('tempo_search_worklogs advertises only the filters the tool accepts', () => {
    const description = describeTool('tempo_search_worklogs');
    expect(description).not.toMatch(/teams|accounts/i);
    expect(description).toMatch(/authors, issues, projects, date range/);
  });
});
