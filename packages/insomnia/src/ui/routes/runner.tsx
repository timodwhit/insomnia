import type { RequestTestResult } from 'insomnia-sdk';
import React, { type FC, useEffect, useState } from 'react';
import { Button, Checkbox, DropIndicator, GridList, GridListItem, type GridListItemProps, Heading, Tab, TabList, TabPanel, Tabs, Toolbar, TooltipTrigger, useDragAndDrop } from 'react-aria-components';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { type ActionFunction, redirect, useLoaderData, useNavigate, useParams, useRouteLoaderData, useSubmit } from 'react-router-dom';
import { useListData } from 'react-stately';

// import type { Settings } from '../../../models/settings';
import { Tooltip } from '../../../src/ui/components/tooltip';
import { isRequest, type Request } from '../../models/request';
import { isRequestGroup } from '../../models/request-group';
import { invariant } from '../../utils/invariant';
import { ErrorBoundary } from '../components/error-boundary';
import { Icon } from '../components/icon';
import { Pane, PaneBody, PaneHeader } from '../components/panes/pane';
import { RequestTestResultPane } from '../components/panes/request-test-result-pane';
import { type CollectionRunnerContext, type RunnerSource, sendActionImp } from './request';
import { useRootLoaderData } from './root';
import type { Child, WorkspaceLoaderData } from './workspace';

const inputStyle = 'placeholder:italic py-0.5 mr-1.5 px-1 w-16 rounded-sm border-2 border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors';
// export interface Props {
//   organizationId: string;
//   projectId: string;
//   workspaceId: string;
//   show: boolean;
//   direction: 'horizontal' | 'vertical';
// }
// const methodTagColors: Record<string, string> = {
// 'GET': 'text-[--color-font-surprise]',
// 'POST': 'text-[--color-font-success]',
// 'HEAD': 'text-[--color-font-info]',
// 'OPTIONS': 'text-[--color-font-info]',
// 'DELETE': 'text-[--color-font-danger]',
// 'PUT': 'text-[--color-font-warning]',
// 'PATCH': 'text-[--color-font-notice]',

// built-in styles
// 'GET': baseTheme.background.surprise,
// 'POST': baseTheme.background.success,
// 'HEAD': baseTheme.background.info,
// 'OPTIONS': baseTheme.background.info,
// 'DELETE': baseTheme.background.danger,
// 'PUT': baseTheme.background.warning,
// 'PATCH': baseTheme.background.notice,

//   'GET': 'rgb(192 132 252)',
//   'POST': 'rgb(163 230 53)',
//   'HEAD': 'rgb(34 211 238)',
//   'OPTIONS': 'rgb(96 165 250)',
//   'DELETE': 'rgb(248 113 113)',
//   'PUT': 'rgb(251 146 60)',
//   'PATCH': 'rgb(253 224 71)',
// };

// export interface Props {
//   organizationId: string;
//   projectId: string;
//   workspaceId: string;
//   direction: 'horizontal' | 'vertical';
//   // settings: Settings;
//   collection: Child[];
// }

export const Runner: FC<{}> = () => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    direction: 'vertical' | 'horizontal';
  };
  const { settings } = useRootLoaderData();
  const { collection } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;

  const [direction, setDirection] = useState<'horizontal' | 'vertical'>(settings.forceVerticalLayout ? 'vertical' : 'horizontal');
  useEffect(() => {
    if (settings.forceVerticalLayout) {
      setDirection('vertical');
      return () => { };
    } else {
      // Listen on media query changes
      const mediaQuery = window.matchMedia('(max-width: 880px)');
      setDirection(mediaQuery.matches ? 'vertical' : 'horizontal');

      const handleChange = (e: MediaQueryListEvent) => {
        setDirection(e.matches ? 'vertical' : 'horizontal');
      };

      mediaQuery.addEventListener('change', handleChange);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }
  }, [settings.forceVerticalLayout, direction]);

  // const runnerStatusFetcher = useFetcher();
  // const loadStatus = runnerStatusFetcher.load;
  // const loadLatestRunnerStatus = useCallback(() => {
  //   loadStatus(
  //     `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/runner/`,
  //   );
  // }, [organizationId, projectId, workspaceId, loadStatus]);

  // useEffect(() => {
  //   setTimeout(loadLatestRunnerStatus, 1000);
  // }, [loadLatestRunnerStatus]);
  const runnerStatus = useLoaderData() as CollectionRunnerContext;

  const [iterations, setIterations] = useState(1);
  const [delay, setDelay] = useState(0);
  const getEntityById = new Map<string, Child>();
  const requestRows = collection
    .filter(item => {
      getEntityById.set(item.doc._id, item);
      return isRequest(item.doc);
    })
    .map((item: Child) => {
      const ancestorNames: string[] = [];
      if (item.ancestors) {
        item.ancestors.forEach(ancestorId => {
          const ancestor = getEntityById.get(ancestorId);
          if (ancestor && isRequestGroup(ancestor?.doc)) {
            ancestorNames.push(ancestor?.doc.name);
          }
        });
      }

      const requestDoc = item.doc as Request;
      invariant('method' in item.doc, 'Only Request is supported at the moment');
      return {
        id: item.doc._id,
        name: item.doc.name,
        ancestorNames,
        method: requestDoc.method,
        url: item.doc.url,
      };
    });
  const reqList = useListData({
    initialItems: requestRows,
  });
  const defaultSelectedkeys = reqList.items.map(item => item.id);

  const { dragAndDropHooks: requestsDnD } = useDragAndDrop({
    getItems: keys => {
      return [...keys].map(key => {
        const name = getEntityById.get(key as string)?.doc.name || '';
        return {
          'text/plain': key.toString(),
          name,
        };
      });
    },
    onReorder: event => {
      if (event.target.dropPosition === 'before') {
        reqList.moveBefore(event.target.key, event.keys);
      } else if (event.target.dropPosition === 'after') {
        reqList.moveAfter(event.target.key, event.keys);
      }
    },
    renderDragPreview(items) {
      return (
        <div className="text-[--color-font-surprise] bg-[rgba(var(--color-surprise-rgb),0.5)] px-2 py-0.5 rounded-md opacity-90" >
          {items[0]['name']}
          {items.length > 1 ? <span> and {items.length - 1} items </span> : <></>}
        </div>
      );
    },
    renderDropIndicator(target) {
      if (target.type === 'item') {
        const item = reqList.items.find(item => item.id === target.key);
        if (item) {
          return (
            <DropIndicator
              target={target}
              className={({ isDropTarget }) => {
                return `${isDropTarget ? 'border border-solid border-[--hl-sm]' : ''}`;
              }}
            />
          );
        }
      }
      return <DropIndicator target={target} />;
    },
  });

  const submit = useSubmit();
  const onRun = () => {
    const selected = new Set(reqList.selectedKeys);
    const requests = Array.from(reqList.items)
      .filter(item => selected.has(item.id));

    submit(
      {
        requests,
        iterations,
        delay,
      },
      {
        method: 'post',
        encType: 'application/json',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/runner/run/`,
      }
    );
  };

  const navigate = useNavigate();
  const goToRequest = (requestId: string) => {
    navigate(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${requestId}`);
  };
  const onToggleSelection = () => {
    if (Array.from(reqList.selectedKeys).length === Array.from(reqList.items).length) {
      // unselect all
      reqList.setSelectedKeys(new Set([]));
    } else {
      // select all
      reqList.setSelectedKeys(new Set(reqList.items.map(item => item.id)));
    }
  };

  return (
    <PanelGroup autoSaveId="insomnia-sidebar" id="wrapper" className='new-sidebar w-full h-full text-[--color-font]' direction='horizontal'>
      <Panel>
        <PanelGroup autoSaveId="insomnia-panels" direction={direction}>

          <Panel id="pane-one" className='pane-one theme--pane'>
            <ErrorBoundary showAlert>

              <Pane type="request">
                <PaneHeader>
                  <Heading className="flex items-center w-full h-[--line-height-sm] pl-[--padding-md]">
                    <div className="w-full text-left">
                      <span className="font-bold mr-4">Runner</span>
                      <span className="mr-8 text-sm">
                        <input
                          defaultValue={1}
                          value={iterations}
                          name='Iterations'
                          onChange={e => {
                            try {
                              const iterCount = parseInt(e.target.value, 10);
                              if (iterCount > 0) {
                                setIterations(iterCount);
                              }
                            } catch (ex) {
                              // no op
                            }
                          }}
                          type='number'
                          className={inputStyle}
                        />
                        <span className="border">Iterations</span>
                      </span>
                      <span className="mr-8 text-sm">
                        <input
                          defaultValue={0}
                          name='Delay'
                          onChange={e => {
                            try {
                              const delay = parseInt(e.target.value, 10);
                              if (delay >= 0) {
                                setDelay(delay);
                              }
                            } catch (ex) {
                              // no op
                            }
                          }}
                          type='number'
                          className={inputStyle}
                        />
                        <span className="mr-1 border">Delay</span>
                      </span>
                      <span className="mr-8 text-sm">
                        <input
                          defaultValue={'...'}
                          name='Data'
                          onChange={() => { }}
                          type='text'
                          className={inputStyle}
                        />
                        <span className="mr-1 border">Data</span>
                      </span>
                    </div>
                    <div className="w-[100px]">
                      <button
                        type="button"
                        className="rounded-sm text-center mr-1 bg-[--color-surprise] text-[--color-font-surprise]"
                        onClick={onRun}
                        style={{ width: '92px', height: '30px' }} // try to make its width same as "Send button"
                      >
                        Run
                      </button>
                    </div>
                  </Heading>
                </PaneHeader>
                <Tabs aria-label='Request group tabs' className="flex-1 w-full h-full flex flex-col">
                  <TabList className='w-full flex-shrink-0  overflow-x-auto border-solid scro border-b border-b-[--hl-md] bg-[--color-bg] flex items-center h-[--line-height-sm]' aria-label='Request pane tabs'>
                    <Tab
                      className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                      id='request-order'
                    >
                      <i className="fa fa-sort fa-1x h-4 mr-2" />
                      Request Order
                    </Tab>
                    <Tab
                      className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                      id='headers'
                    >
                      <i className="fa fa-gear fa-1x h-4 mr-2" />
                      Advanced
                    </Tab>
                  </TabList>
                  <TabPanel className='w-full flex-1 flex flex-col overflow-hidden' id='request-order'>
                    <Toolbar className="w-full flex-shrink-0 h-[--line-height-sm] border-b border-solid border-[--hl-md] flex items-center px-2">
                      {
                        Array.from(reqList.selectedKeys).length === Array.from(reqList.items).length ?
                          <span onClick={onToggleSelection}><i style={{ color: 'rgb(74 222 128)' }} className="fa fa-square-check fa-1x h-4 mr-2" /> <span className="cursor-pointer" >Unselect All</span></span> :
                          Array.from(reqList.selectedKeys).length === 0 ?
                            <span onClick={onToggleSelection}><i className="fa fa-square fa-1x h-4 mr-2" /> <span className="cursor-pointer" >Select All</span></span> :
                            <span onClick={onToggleSelection}><i style={{ color: 'rgb(74 222 128)' }} className="fa fa-square-minus fa-1x h-4 mr-2" /> <span className="cursor-pointer" >Select All</span></span>
                      }
                    </Toolbar>
                    <PaneBody placeholder className='p-0'>
                      <GridList
                        id="runner-request-list"
                        // style={{ height: virtualizer.getTotalSize() }}
                        items={reqList.items}
                        selectionMode="multiple"
                        selectedKeys={reqList.selectedKeys}
                        onSelectionChange={reqList.setSelectedKeys}
                        defaultSelectedKeys={defaultSelectedkeys}
                        aria-label="Request Collection"
                        dragAndDropHooks={requestsDnD}
                        className="w-full h-full leading-8 text-base overflow-auto"
                      >
                        {item => {
                          const parentFolders = item.ancestorNames.map((parentFolderName: string, i: number) => {
                            // eslint-disable-next-line react/no-array-index-key
                            return <TooltipTrigger key={`parent-folder-${i}=${parentFolderName}`} >
                              <i className="fa fa-folder fa-1x h-4 mr-0.3 text-[--color-font]" />
                              <i className="fa fa-caret-right fa-1x h-4 mr-0.3 text-[--color-font]-50  opacity-50" />
                              <Tooltip message={parentFolderName}>
                                {''}
                              </Tooltip>
                            </TooltipTrigger>;
                          });
                          const parentFolderContainer = parentFolders.length > 0 ? <span className="ml-2">{parentFolders}</span> : null;

                          return (
                            <RequestItem className='text-[--color-font] border border-solid border-transparent' style={{ 'outline': 'none' }}>
                              {parentFolderContainer}
                              <span className={`ml-2 uppercase text-xs http-method-${item.method}`}>{item.method}</span>
                              <span className="ml-2" style={{ color: 'white' }} onClick={() => goToRequest(item.id)}>{item.name}</span>
                            </RequestItem>
                          );
                        }}
                      </GridList>
                    </PaneBody>
                  </TabPanel>
                  <TabPanel className='w-full flex-1 flex flex-col overflow-y-auto' id='headers'>
                    <></>
                  </TabPanel>
                </Tabs>
              </Pane>
            </ErrorBoundary>
          </Panel>
          <PanelResizeHandle className={direction === 'horizontal' ? 'h-full w-[1px] bg-[--hl-md]' : 'w-full h-[1px] bg-[--hl-md]'} />
          <Panel id="pane-two" className='pane-two theme--pane'>
            <PaneHeader className="row-spaced">
              <Heading className="flex items-center w-full h-[--line-height-sm] pl-3 border-solid scro border-b border-b-[--hl-md]">
                {
                  runnerStatus.duration ? <div className="bg-info tag" >
                    <strong>{`${runnerStatus.duration} ms`}</strong>
                  </div> : 'Test Results'
                }
              </Heading>
            </PaneHeader>
            <Tabs aria-label='Request group tabs' className="flex-1 w-full h-full flex flex-col">
              <TabList className='w-full flex-shrink-0  overflow-x-auto border-solid scro border-b border-b-[--hl-md] bg-[--color-bg] flex items-center h-[--line-height-sm]' aria-label='Request pane tabs'>
                <Tab
                  className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                  id='test-results'
                >
                  <div>
                    <span>
                      Tests
                    </span>
                  </div>
                </Tab>
                <Tab
                  className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                  id='console'
                >
                  Console
                </Tab>
                <Tab
                  className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                  id='history'
                >
                  History
                </Tab>
              </TabList>
              <TabPanel className='w-full flex-1 flex flex-col overflow-hidden' id='console'>
                <></>
              </TabPanel>
              <TabPanel
                className='w-full flex-1 flex flex-col overflow-y-auto'
                id='test-results'
              >
                <ErrorBoundary showAlert>
                  <RequestTestResultPane requestTestResults={runnerStatus.results || []} />
                </ErrorBoundary>
              </TabPanel>
            </Tabs>

          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
};

export default Runner;

const RequestItem = (
  { children, ...props }: GridListItemProps
) => {

  return (
    <GridListItem {...props}>
      {() => (
        <>
          <Button slot="drag" className="hover:cursor-grab">
            <Icon icon="grip-vertical" className='w-2 text-[--hl] mr-2' />
          </Button>
          <Checkbox slot="selection">
            {({ isSelected }) => {
              return <>
                {isSelected ?
                  <i className="fa fa-square-check fa-1x h-4 mr-2" style={{ color: 'rgb(74 222 128)' }} /> :
                  <i className="fa fa-square fa-1x h-4 mr-2" />
                }
              </>;
            }}
          </Checkbox>
          {children}
        </>
      )}
    </GridListItem>
  );
};

export interface runCollectionActionParams {
  requests: { id: string; name: string }[];
}

export const runCollectionAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(organizationId, 'Organization id is required');
  invariant(projectId, 'Project id is required');
  invariant(workspaceId, 'Workspace id is required');
  const { requests, iterations, delay } = await request.json();
  const source: RunnerSource = 'runner';

  let testCtx = {
    source,
    environmentId: '',
    iterations: 1,
    iterationData: {},
    duration: 0,
    testCount: 0,
    avgRespTime: 0,
    results: new Array<RequestTestResult>(),
  };

  for (let i = 0; i < iterations; i++) {
    for (const request of requests) {
      await new Promise(resolve => setTimeout(resolve, delay));
      const resultCollector = {
        requestId: request.id,
        requestName: request.name,
        requestUrl: request.name,
        responseReason: '',
        duration: 0,
        size: 0,
        results: new Array<RequestTestResult>(),
      };
      await sendActionImp({
        requestId: request.id,
        workspaceId,
        shouldPromptForPathAfterResponse: false,
        ignoreUndefinedEnvVariable: false,
        testResultCollector: resultCollector,
      });

      testCtx = {
        ...testCtx,
        duration: testCtx.duration + resultCollector.duration,
        results: [...testCtx.results, ...resultCollector.results],
      };
      // const ctxStr = JSON.stringify(testCtx);
      updateCollectionRunnerStatus(workspaceId, testCtx);
    }
  }

  // return testCtx;
  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/runner/`);
};

// workspaceId -> context
const collectionRunnerStatus = new Map<string, CollectionRunnerContext>();
export function updateCollectionRunnerStatus(workspaceId: string, ctx: CollectionRunnerContext) {
  collectionRunnerStatus.set(workspaceId, ctx);
};
export function getCollectionRunnerStatus(workspaceId: string) {
  return collectionRunnerStatus.get(workspaceId);
};

export const updateRunnerStatusAction: ActionFunction = async ({ params }) => {
  const { workspaceId, ctx } = params;
  invariant(workspaceId, 'Workspace id is required');
  invariant(ctx, 'Context id is required');
  const ctxObj = JSON.parse(ctx);

  collectionRunnerStatus.set(workspaceId, ctxObj);
};

export const collectionRunnerStatusLoader: ActionFunction = async ({ params }) => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace id is required');

  const status = getCollectionRunnerStatus(workspaceId);
  return { ...status };
};
