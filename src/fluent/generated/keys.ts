import '@servicenow/sdk/global'

declare global {
    namespace Now {
        namespace Internal {
            interface Keys extends KeysRegistry {
                explicit: {
                    'aiux-experience-extension|experience-extension-sn_ex_emp_hub_mw-salesportal': {
                        table: 'sys_aix_experience_extension'
                        id: 'f2bc8e898b0414d9dced0e463554721a'
                    }
                    'aiux-experience-page-rel|x-snc-slux-case-record-page': {
                        table: 'sys_aix_experience_page_rel'
                        id: 'e3bfd73dc3dcbfe242af89f0bfe3e05c'
                    }
                    'aiux-layout-widget|lifecycle-ext-sn_ex_emp_hub_mw-salesportal': {
                        table: 'sys_aix_widget'
                        id: 'a15463bef6095222bf67290b5108fc33'
                    }
                    'aiux-page-widget|x-snc-slux-case-record-page': {
                        table: 'sys_aix_widget'
                        id: 'c11a165f56b3bef2efd1849a7790a07d'
                    }
                    'aiux-page|x-snc-slux-case-record-page': {
                        table: 'sys_aix_page'
                        id: 'a9b2440d530e230a5c5371097ee9cd69'
                    }
                    'aiux-project|x_snc_slux': {
                        table: 'sys_aix_project'
                        id: '3fade3f15dba0fcc7a8c912c6d8c89f0'
                    }
                    bom_json: {
                        table: 'sys_module'
                        id: 'fe66ba869a7445019448cfe369093899'
                    }
                    package_json: {
                        table: 'sys_module'
                        id: '05414377829a44cda61dff08ba82ddc8'
                    }
                }
                composite: [
                    {
                        table: 'sn_glider_source_artifact'
                        id: '552d838d2df646189ee73939dcd7c9fc'
                        key: {
                            name: 'aiux-source 3fade3f15dba0fcc7a8c912c6d8c89f0'
                        }
                    },
                    {
                        table: 'sn_glider_source_artifact_m2m'
                        id: 'bbb39624a1af419f9056eca5766434b5'
                        key: {
                            application_file: '3fade3f15dba0fcc7a8c912c6d8c89f0'
                            source_artifact: '552d838d2df646189ee73939dcd7c9fc'
                        }
                    },
                ]
            }
        }
    }
}
