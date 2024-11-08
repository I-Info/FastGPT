import React, { useCallback, useMemo } from 'react';
import type { RenderInputProps } from '../type';
import { Flex, Box, ButtonProps, Grid } from '@chakra-ui/react';
import MyIcon from '@fastgpt/web/components/common/Icon';
import { computedNodeInputReference } from '@/web/core/workflow/utils';
import { useTranslation } from 'next-i18next';
import {
  NodeOutputKeyEnum,
  WorkflowIOValueTypeEnum
} from '@fastgpt/global/core/workflow/constants';
import type {
  ReferenceArrayValueType,
  ReferenceItemValueType,
  ReferenceValueType
} from '@fastgpt/global/core/workflow/type/io';
import dynamic from 'next/dynamic';
import { useContextSelector } from 'use-context-selector';
import { WorkflowContext } from '@/pages/app/detail/components/WorkflowComponents/context';
import { FlowNodeTypeEnum } from '@fastgpt/global/core/workflow/node/constant';
import { AppContext } from '@/pages/app/detail/components/context';
import { WorkflowActionContext } from '../../../../../context/workflowInitContext';

const MultipleRowSelect = dynamic(() =>
  import('@fastgpt/web/components/common/MySelect/MultipleRowSelect').then(
    (v) => v.MultipleRowSelect
  )
);
const MultipleRowArraySelect = dynamic(() =>
  import('@fastgpt/web/components/common/MySelect/MultipleRowSelect').then(
    (v) => v.MultipleRowArraySelect
  )
);
const Avatar = dynamic(() => import('@fastgpt/web/components/common/Avatar'));

type CommonSelectProps = {
  placeholder?: string;
  list: {
    label: string | React.ReactNode;
    value: string;
    children: {
      label: string;
      value: string;
      valueType?: WorkflowIOValueTypeEnum;
    }[];
  }[];
  popDirection?: 'top' | 'bottom';
  styles?: ButtonProps;
};
type SelectProps<T extends boolean> = CommonSelectProps & {
  isArray?: T;
  value?: T extends true ? ReferenceArrayValueType : ReferenceItemValueType;
  onSelect: (val?: T extends true ? ReferenceArrayValueType : ReferenceItemValueType) => void;
};

export const useReference = ({
  nodeId,
  valueType = WorkflowIOValueTypeEnum.any
}: {
  nodeId: string;
  valueType?: WorkflowIOValueTypeEnum;
}) => {
  const { t } = useTranslation();
  const appDetail = useContextSelector(AppContext, (v) => v.appDetail);
  const edges = useContextSelector(WorkflowActionContext, (v) => v.edges);
  const nodeList = useContextSelector(WorkflowContext, (v) => v.nodeList);

  // 获取可选的变量列表
  const referenceList = useMemo(() => {
    const sourceNodes = computedNodeInputReference({
      nodeId,
      nodes: nodeList,
      edges: edges,
      chatConfig: appDetail.chatConfig,
      t
    });

    if (!sourceNodes) return [];

    const isArray = valueType?.includes('array');
    const arrayItemType = isArray ? valueType.replace('array', '').toLowerCase() : valueType;

    // 转换为 select 的数据结构
    const list: CommonSelectProps['list'] = sourceNodes
      .map((node) => {
        return {
          label: (
            <Flex alignItems={'center'}>
              <Avatar src={node.avatar} w={isArray ? '1rem' : '1.25rem'} borderRadius={'xs'} />
              <Box ml={1}>{t(node.name as any)}</Box>
            </Flex>
          ),
          value: node.nodeId,
          children: node.outputs
            .filter(
              (output) =>
                valueType === WorkflowIOValueTypeEnum.any ||
                valueType === WorkflowIOValueTypeEnum.arrayAny ||
                output.valueType === WorkflowIOValueTypeEnum.any ||
                output.valueType === valueType ||
                // Array<String> can select string
                arrayItemType === output.valueType
            )
            .filter((output) => output.id !== NodeOutputKeyEnum.addOutputParam)
            .map((output) => {
              return {
                label: t(output.label as any),
                value: output.id,
                valueType: output.valueType
              };
            })
        };
      })
      .filter((item) => item.children.length > 0);

    return list;
  }, [appDetail.chatConfig, edges, nodeId, nodeList, t, valueType]);

  return {
    referenceList
  };
};

const Reference = ({ item, nodeId }: RenderInputProps) => {
  const { t } = useTranslation();
  const { onChangeNode, nodeList } = useContextSelector(WorkflowContext, (v) => v);
  const isArray = item.valueType?.includes('array') ?? false;

  const onSelect = useCallback(
    (e: ReferenceValueType) => {
      onChangeNode({
        nodeId,
        type: 'updateInput',
        key: item.key,
        value: {
          ...item,
          value: e
        }
      });
    },
    [item, nodeId, onChangeNode]
  );

  const { referenceList } = useReference({
    nodeId,
    valueType: item.valueType
  });

  const popDirection = useMemo(() => {
    const node = nodeList.find((node) => node.nodeId === nodeId);
    if (!node) return 'bottom';
    return node.flowNodeType === FlowNodeTypeEnum.loop ? 'top' : 'bottom';
  }, [nodeId, nodeList]);

  return (
    <ReferSelector
      placeholder={t(item.referencePlaceholder as any) || t('common:select_reference_variable')}
      list={referenceList}
      value={item.value}
      onSelect={onSelect}
      popDirection={popDirection}
      isArray={isArray}
    />
  );
};

export default React.memo(Reference);

const SingleReferenceSelector = ({
  placeholder,
  value,
  list = [],
  onSelect,
  popDirection
}: SelectProps<false>) => {
  const getSelectValue = useCallback(
    (value: ReferenceValueType) => {
      if (!value) return [];

      const firstColumn = list.find((item) => item.value === value[0]);
      if (!firstColumn) {
        return [];
      }
      const secondColumn = firstColumn.children.find((item) => item.value === value[1]);
      if (!secondColumn) {
        return [];
      }
      return [firstColumn.label, secondColumn.label];
    },
    [list]
  );

  const ItemSelector = useMemo(() => {
    const selectorVal = value as ReferenceItemValueType;
    const [nodeName, outputName] = getSelectValue(selectorVal);
    const isValidSelect = nodeName && outputName;

    return (
      <MultipleRowSelect
        label={
          isValidSelect ? (
            <Flex gap={2} alignItems={'center'} fontSize={'sm'}>
              <Flex py={1} pl={1}>
                {nodeName}
                <MyIcon name={'common/rightArrowLight'} mx={1} w={'12px'} color={'myGray.500'} />
                {outputName}
              </Flex>
            </Flex>
          ) : (
            <Box fontSize={'sm'} color={'myGray.400'}>
              {placeholder}
            </Box>
          )
        }
        value={selectorVal}
        list={list}
        onSelect={onSelect as any}
        popDirection={popDirection}
      />
    );
  }, [getSelectValue, list, onSelect, placeholder, popDirection, value]);

  return ItemSelector;
};
const MultipleReferenceSelector = ({
  placeholder,
  value,
  list = [],
  onSelect,
  popDirection
}: SelectProps<true>) => {
  const { t } = useTranslation();

  const getSelectValue = useCallback(
    (value: ReferenceValueType) => {
      if (!value) return [];

      const firstColumn = list.find((item) => item.value === value[0]);
      if (!firstColumn) {
        return [];
      }
      const secondColumn = firstColumn.children.find((item) => item.value === value[1]);
      if (!secondColumn) {
        return [];
      }
      return [firstColumn.label, secondColumn.label];
    },
    [list]
  );

  const ArraySelector = useMemo(() => {
    const selectorVal = value as ReferenceItemValueType[];
    const notValidItem =
      !selectorVal ||
      selectorVal.length === 0 ||
      selectorVal.every((item) => {
        const [nodeName, outputName] = getSelectValue(item);
        return !nodeName || !outputName;
      });

    return (
      <MultipleRowArraySelect
        label={
          !notValidItem ? (
            <Grid py={3} gridTemplateColumns={'1fr 1fr'} gap={2} fontSize={'sm'}>
              {selectorVal.map((item, index) => {
                const [nodeName, outputName] = getSelectValue(item);
                const isInvalidItem = !nodeName || !outputName;

                return (
                  <Flex
                    alignItems={'center'}
                    key={index}
                    bg={'primary.50'}
                    color={'myGray.900'}
                    py={1}
                    px={1.5}
                    rounded={'sm'}
                  >
                    <Flex
                      alignItems={'center'}
                      flex={'1 0 0'}
                      maxW={'200px'}
                      className="textEllipsis"
                    >
                      {nodeName}
                      <MyIcon
                        name={'common/rightArrowLight'}
                        mx={1}
                        w={'12px'}
                        color={'myGray.500'}
                      />
                      {outputName}
                    </Flex>
                    <MyIcon
                      name={'common/closeLight'}
                      w={'1rem'}
                      ml={1}
                      cursor={'pointer'}
                      color={'myGray.500'}
                      _hover={{
                        color: 'red.600'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(value?.filter((_, i) => i !== index));
                      }}
                    />
                  </Flex>
                );
              })}
            </Grid>
          ) : (
            <Box fontSize={'sm'} color={'myGray.400'}>
              {placeholder}
            </Box>
          )
        }
        value={selectorVal as any}
        list={list}
        onSelect={onSelect as any}
        popDirection={popDirection}
      />
    );
  }, [getSelectValue, list, onSelect, placeholder, popDirection, value]);

  return ArraySelector;
};
export const ReferSelector = <T extends boolean>(props: SelectProps<T>) => {
  return props.isArray ? (
    <MultipleReferenceSelector {...(props as SelectProps<true>)} />
  ) : (
    <SingleReferenceSelector {...(props as SelectProps<false>)} />
  );
};
