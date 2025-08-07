export const CORE_MENU_COMMANDS = [
  [['Workflow'], ['Comfy.NewBlankWorkflow']],
  [['Workflow'], ['Comfy.OpenWorkflow', 'Comfy.BrowseTemplates']],
  [
    ['Workflow'],
    [
      'Comfy.SaveWorkflow',
      'Comfy.SaveWorkflowAs'
    ]
  ],
  [['Edit'], ['Comfy.Undo', 'Comfy.Redo']],
  [['Edit'], ['Comfy.RefreshNodeDefinitions']],
  [['Edit'], ['Comfy.ClearWorkflow']],
  [['Edit'], ['Comfy.OpenClipspace']],
  // Commented out Help menu - ComfyUI specific items don't apply to DNNE
  // [
  //   ['Help'],
  //   [
  //     'Comfy.Help.OpenComfyUIIssues',
  //     'Comfy.Help.OpenComfyUIDocs',
  //     'Comfy.Help.OpenComfyOrgDiscord',
  //     'Comfy.Help.OpenComfyUIForum'
  //   ]
  // ],
  // [
  //   ['Help'],
  //   ['Comfy.Help.AboutComfyUI', 'Comfy.Feedback', 'Comfy.ContactSupport']
  // ],
  // DNNE menu - placeholder for future features
  [['DNNE'], []]  // Will add items like 'DNNE.ShowAllLogs' when implemented
]
