/**
 * 7 种排序的教学 C 代码与元数据（复杂度/稳定性）。
 * Step.codeLine 指向各算法自己的行号（1-based）。
 */

export type SortId = 'bubble' | 'selection' | 'insertion' | 'shell' | 'merge' | 'quick' | 'heap';

export interface SortMeta {
  id: SortId;
  name: string;
  timeBest: string;
  timeAvg: string;
  timeWorst: string;
  space: string;
  stable: boolean;
  feature: string;
}

export const SORT_METAS: Record<SortId, SortMeta> = {
  bubble: {
    id: 'bubble',
    name: '冒泡排序',
    timeBest: 'O(n)',
    timeAvg: 'O(n²)',
    timeWorst: 'O(n²)',
    space: 'O(1)',
    stable: true,
    feature: '相邻比较交换，每一趟把最大值"冒"到末尾',
  },
  selection: {
    id: 'selection',
    name: '选择排序',
    timeBest: 'O(n²)',
    timeAvg: 'O(n²)',
    timeWorst: 'O(n²)',
    space: 'O(1)',
    stable: false,
    feature: '每轮选出最小值放到前面，交换次数最少',
  },
  insertion: {
    id: 'insertion',
    name: '插入排序',
    timeBest: 'O(n)',
    timeAvg: 'O(n²)',
    timeWorst: 'O(n²)',
    space: 'O(1)',
    stable: true,
    feature: '像整理扑克牌：把新牌插到前面合适的位置',
  },
  shell: {
    id: 'shell',
    name: '希尔排序',
    timeBest: 'O(n log n)',
    timeAvg: '约 O(n^1.3)',
    timeWorst: 'O(n²)',
    space: 'O(1)',
    stable: false,
    feature: '带间隔的插入排序，间隔逐趟减半',
  },
  merge: {
    id: 'merge',
    name: '归并排序',
    timeBest: 'O(n log n)',
    timeAvg: 'O(n log n)',
    timeWorst: 'O(n log n)',
    space: 'O(n)',
    stable: true,
    feature: '分治：分成两半分别排好，再线性合并',
  },
  quick: {
    id: 'quick',
    name: '快速排序',
    timeBest: 'O(n log n)',
    timeAvg: 'O(n log n)',
    timeWorst: 'O(n²)',
    space: 'O(log n)',
    stable: false,
    feature: '分治：选基准分区，小的去左大的去右',
  },
  heap: {
    id: 'heap',
    name: '堆排序',
    timeBest: 'O(n log n)',
    timeAvg: 'O(n log n)',
    timeWorst: 'O(n log n)',
    space: 'O(1)',
    stable: false,
    feature: '建最大堆，逐个取堆顶放到末尾',
  },
};

export const BUBBLE_C_CODE: string[] = [
  '/* 冒泡排序：相邻比较，大的往后冒 */',
  'void bubbleSort(int a[], int n) {',
  '    for (int i = 0; i < n - 1; i++) {      /* 一共 n-1 趟 */',
  '        int swapped = 0;',
  '        for (int j = 0; j < n - 1 - i; j++) {',
  '            if (a[j] > a[j + 1]) {          /* 前面比后面大 */',
  '                int tmp = a[j];             /* 就交换 */',
  '                a[j] = a[j + 1];',
  '                a[j + 1] = tmp;',
  '                swapped = 1;',
  '            }',
  '        }',
  '        if (swapped == 0) {',
  '            break;                          /* 一趟没交换：已经有序 */',
  '        }',
  '    }',
  '}',
];

export const SELECTION_C_CODE: string[] = [
  '/* 选择排序：每轮选最小的放到前面 */',
  'void selectionSort(int a[], int n) {',
  '    for (int i = 0; i < n - 1; i++) {',
  '        int min = i;                        /* 假设当前位置就是最小 */',
  '        for (int j = i + 1; j < n; j++) {',
  '            if (a[j] < a[min]) {',
  '                min = j;                    /* 发现更小的，记住下标 */',
  '            }',
  '        }',
  '        if (min != i) {',
  '            int tmp = a[i];                 /* 把最小值换到当前位置 */',
  '            a[i] = a[min];',
  '            a[min] = tmp;',
  '        }',
  '    }',
  '}',
];

export const INSERTION_C_CODE: string[] = [
  '/* 插入排序：把每个新元素插进前面已排好的部分 */',
  'void insertionSort(int a[], int n) {',
  '    for (int i = 1; i < n; i++) {',
  '        int key = a[i];                     /* 抽出这张"牌" */',
  '        int j = i - 1;',
  '        while (j >= 0 && a[j] > key) {      /* 前面比它大的都往后挪 */',
  '            a[j + 1] = a[j];',
  '            j--;',
  '        }',
  '        a[j + 1] = key;                     /* 放进空出来的位置 */',
  '    }',
  '}',
];

export const SHELL_C_CODE: string[] = [
  '/* 希尔排序：间隔逐趟减半的插入排序 */',
  'void shellSort(int a[], int n) {',
  '    for (int gap = n / 2; gap > 0; gap /= 2) {   /* 间隔序列 n/2, n/4, ..., 1 */',
  '        for (int i = gap; i < n; i++) {',
  '            int key = a[i];',
  '            int j = i - gap;',
  '            while (j >= 0 && a[j] > key) {  /* 同间隔的比较，跳着比 */',
  '                a[j + gap] = a[j];',
  '                j -= gap;',
  '            }',
  '            a[j + gap] = key;',
  '        }',
  '    }',
  '}',
];

export const MERGE_C_CODE: string[] = [
  '/* 归并排序：分治 + 合并两个有序数组 */',
  'void merge(int a[], int tmp[], int left, int mid, int right) {',
  '    int i = left, j = mid + 1, k = left;',
  '    while (i <= mid && j <= right) {        /* 双指针取小者 */',
  '        if (a[i] <= a[j]) {',
  '            tmp[k++] = a[i++];',
  '        } else {',
  '            tmp[k++] = a[j++];',
  '        }',
  '    }',
  '    while (i <= mid) { tmp[k++] = a[i++]; } /* 左半剩余 */',
  '    while (j <= right) { tmp[k++] = a[j++]; } /* 右半剩余 */',
  '    for (k = left; k <= right; k++) {',
  '        a[k] = tmp[k];                      /* 写回原数组 */',
  '    }',
  '}',
  '',
  'void mergeSort(int a[], int tmp[], int left, int right) {',
  '    if (left >= right) {',
  '        return;                             /* 0/1 个元素天然有序 */',
  '    }',
  '    int mid = (left + right) / 2;',
  '    mergeSort(a, tmp, left, mid);           /* 排左半 */',
  '    mergeSort(a, tmp, mid + 1, right);      /* 排右半 */',
  '    merge(a, tmp, left, mid, right);        /* 合并 */',
  '}',
  '',
  '/* 调用方式：mergeSort(a, tmp, 0, n - 1) */',
];

export const QUICK_C_CODE: string[] = [
  '/* 快速排序：选基准分区（Lomuto 分区，初学者友好）*/',
  'int partition(int a[], int low, int high) {',
  '    int pivot = a[high];                    /* 取最后一个当基准 */',
  '    int i = low - 1;                        /* i 是"小于区"的右边界 */',
  '    for (int j = low; j < high; j++) {',
  '        if (a[j] < pivot) {',
  '            i++;',
  '            int tmp = a[i]; a[i] = a[j]; a[j] = tmp;  /* 换进小于区 */',
  '        }',
  '    }',
  '    int tmp = a[i + 1]; a[i + 1] = a[high]; a[high] = tmp;  /* 基准归位 */',
  '    return i + 1;                           /* 返回基准的最终位置 */',
  '}',
  '',
  'void quickSort(int a[], int low, int high) {',
  '    if (low >= high) {',
  '        return;',
  '    }',
  '    int p = partition(a, low, high);        /* 分区后 p 已就位 */',
  '    quickSort(a, low, p - 1);               /* 排基准左边 */',
  '    quickSort(a, p + 1, high);              /* 排基准右边 */',
  '}',
];

export const HEAPSORT_C_CODE: string[] = [
  '/* 堆排序：建堆 + 逐个取堆顶 */',
  'void siftDown(int a[], int i, int n) {      /* 让 a[i] 下沉到正确位置 */',
  '    while (1) {',
  '        int largest = i;',
  '        int left = 2 * i + 1, right = 2 * i + 2;',
  '        if (left < n && a[left] > a[largest]) {',
  '            largest = left;',
  '        }',
  '        if (right < n && a[right] > a[largest]) {',
  '            largest = right;',
  '        }',
  '        if (largest == i) {',
  '            break;',
  '        }',
  '        int tmp = a[i]; a[i] = a[largest]; a[largest] = tmp;',
  '        i = largest;',
  '    }',
  '}',
  '',
  'void heapSort(int a[], int n) {',
  '    for (int i = n / 2 - 1; i >= 0; i--) {  /* 1. Floyd 建最大堆 */',
  '        siftDown(a, i, n);',
  '    }',
  '    for (int end = n - 1; end > 0; end--) { /* 2. 堆顶(最大)与末尾交换 */',
  '        int tmp = a[0]; a[0] = a[end]; a[end] = tmp;',
  '        siftDown(a, 0, end);                /* 堆缩小，恢复堆性质 */',
  '    }',
  '}',
];

/** 各算法 C 代码行数组 */
export const SORT_C_CODES: Record<SortId, string[]> = {
  bubble: BUBBLE_C_CODE,
  selection: SELECTION_C_CODE,
  insertion: INSERTION_C_CODE,
  shell: SHELL_C_CODE,
  merge: MERGE_C_CODE,
  quick: QUICK_C_CODE,
  heap: HEAPSORT_C_CODE,
};
