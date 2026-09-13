import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isGithubSshGreeting, parseGitmodulesGithubUrls } from './git.js';

describe('parseGitmodulesGithubUrls', () => {
  it('extrai só URLs https do GitHub', () => {
    const raw = ['[submodule ".claude/skills"]', '\tpath = .claude/skills', '\turl = https://github.com/mentoria-360/skills-ddd-clean', '[submodule "packages/shared"]', '\turl = git@github.com:mentoria-360/shared.git'].join('\n');
    assert.deepEqual(parseGitmodulesGithubUrls(raw), ['https://github.com/mentoria-360/skills-ddd-clean']);
  });
});

describe('isGithubSshGreeting', () => {
  it('reconhece a saudação do GitHub com código 1', () => {
    assert.equal(isGithubSshGreeting(1, "Hi leo! You've successfully authenticated, but GitHub does not provide shell access."), true);
    assert.equal(isGithubSshGreeting(255, 'Permission denied (publickey).'), false);
    assert.equal(isGithubSshGreeting(0, ''), false);
  });
});
