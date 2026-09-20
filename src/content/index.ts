/**
 * 课程内容汇总：14 章 + C 代码注册表。
 */
import type { Chapter, CProgramRef } from './types';
import { CH00, CH00_C_PROGRAMS } from './chapters/ch00';
import { CH01, CH01_C_PROGRAMS } from './chapters/ch01';
import {
  CH02,
  CH03,
  CH04,
  CH05,
  CH06,
  CH07,
  CH02_C_PROGRAMS,
  CH03_C_PROGRAMS,
  CH04_C_PROGRAMS,
  CH05_C_PROGRAMS,
  CH06_C_PROGRAMS,
  CH07_C_PROGRAMS,
} from './chapters/ch02-07';
import {
  CH08,
  CH09,
  CH10,
  CH11,
  CH12,
  CH13,
  CH08_C_PROGRAMS,
  CH09_C_PROGRAMS,
  CH10_C_PROGRAMS,
  CH11_C_PROGRAMS,
  CH12_C_PROGRAMS,
  CH13_C_PROGRAMS,
} from './chapters/ch08-13';

export const CHAPTERS: Chapter[] = [CH00, CH01, CH02, CH03, CH04, CH05, CH06, CH07, CH08, CH09, CH10, CH11, CH12, CH13];

/** 全部教学 C 代码（id 唯一注册表） */
export const C_PROGRAMS: Record<string, CProgramRef> = Object.fromEntries(
  [
    ...CH00_C_PROGRAMS,
    ...CH01_C_PROGRAMS,
    ...CH02_C_PROGRAMS,
    ...CH03_C_PROGRAMS,
    ...CH04_C_PROGRAMS,
    ...CH05_C_PROGRAMS,
    ...CH06_C_PROGRAMS,
    ...CH07_C_PROGRAMS,
    ...CH08_C_PROGRAMS,
    ...CH09_C_PROGRAMS,
    ...CH10_C_PROGRAMS,
    ...CH11_C_PROGRAMS,
    ...CH12_C_PROGRAMS,
    ...CH13_C_PROGRAMS,
  ].map((p) => [p.id, p]),
);

export function getChapter(id: number): Chapter | undefined {
  return CHAPTERS.find((c) => c.id === id);
}

/** 搜索用：全部知识点条目（章节 + 关键词） */
export interface KnowledgeEntry {
  kind: 'chapter' | 'topic';
  chapter: number;
  title: string;
  keywords: string[];
}

export const KNOWLEDGE_INDEX: KnowledgeEntry[] = CHAPTERS.map((c) => ({
  kind: 'chapter' as const,
  chapter: c.id,
  title: c.title,
  keywords: c.keywords,
}));

export type { Chapter, CProgramRef, Section, SectionKind, VizOpSpec } from './types';
export { SECTION_KIND_TITLES, SECTION_ORDER } from './types';
