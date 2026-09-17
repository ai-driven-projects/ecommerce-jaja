import { ORDER_STATUSES } from '@jaja/orders';
import { describe, expect, it } from 'vitest';
import { toOrderFilters } from './order-admin-http.js';

describe('toOrderFilters', () => {
  it('uses page 1 and pageSize 20 without parameters', () => {
    expect(toOrderFilters({})).toEqual({ page: 1, pageSize: 20 });
    expect(toOrderFilters(undefined)).toEqual({ page: 1, pageSize: 20 });
  });

  it('keeps valid page and pageSize', () => {
    expect(toOrderFilters({ page: '3', pageSize: '50' })).toEqual({ page: 3, pageSize: 50 });
    expect(toOrderFilters({ page: ' 2 ', pageSize: '100' })).toEqual({ page: 2, pageSize: 100 });
  });

  it('caps pageSize at 100', () => {
    expect(toOrderFilters({ pageSize: '101' }).pageSize).toBe(100);
    expect(toOrderFilters({ pageSize: '100000' }).pageSize).toBe(100);
  });

  it.each(['0', '-1', 'abc', '1.5', '', ' ', '2e3', '99999999999999999999'])(
    'falls back to the defaults for page and pageSize "%s"',
    (value) => {
      expect(toOrderFilters({ page: value, pageSize: value })).toEqual({ page: 1, pageSize: 20 });
    },
  );

  it('falls back to the defaults for values that are not text', () => {
    expect(toOrderFilters({ page: ['2', '3'], pageSize: 10 })).toEqual({ page: 1, pageSize: 20 });
  });

  it.each([...ORDER_STATUSES, 'IN_PROGRESS'])('accepts the status "%s"', (status) => {
    expect(toOrderFilters({ status })).toEqual({ page: 1, pageSize: 20, status });
  });

  it.each(['XYZ', 'delivered', 'in_progress', '', ' DELIVERED'])('ignores the status "%s"', (status) => {
    expect(toOrderFilters({ status })).toEqual({ page: 1, pageSize: 20 });
  });

  it('ignores a repeated status', () => {
    expect(toOrderFilters({ status: ['DELIVERED', 'PLACED'] })).toEqual({ page: 1, pageSize: 20 });
  });

  it('trims the search', () => {
    expect(toOrderFilters({ search: '  ana pereira  ' })).toEqual({
      page: 1,
      pageSize: 20,
      search: 'ana pereira',
    });
  });

  it.each(['', '   ', undefined])('ignores the empty search %j', (search) => {
    expect(toOrderFilters({ search })).toEqual({ page: 1, pageSize: 20 });
  });

  it('ignores a search that is not text', () => {
    expect(toOrderFilters({ search: ['ana', 'bia'] })).toEqual({ page: 1, pageSize: 20 });
  });

  it('combines every filter', () => {
    expect(
      toOrderFilters({ page: '2', pageSize: '1', status: 'IN_PROGRESS', search: ' 0cfd7dab ' }),
    ).toEqual({ page: 2, pageSize: 1, status: 'IN_PROGRESS', search: '0cfd7dab' });
  });
});
