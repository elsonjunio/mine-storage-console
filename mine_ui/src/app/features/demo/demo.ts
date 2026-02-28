import { Component } from '@angular/core';
import {
  UiButtonComponent,
  UiInputTextComponent,
  UiSelectComponent,
  UiCheckboxComponent,
  UiToggleComponent,
  UiBadgeComponent,
  UiProgressBarComponent,
  UiCardComponent,
  UiTableComponent,
  UiStatCardComponent,
} from '../../shared/components';
import { SelectOption } from '../../shared/components/ui-select/ui-select.component';

@Component({
  selector: 'app-demo',
  imports: [
    UiButtonComponent,
    UiInputTextComponent,
    UiSelectComponent,
    UiCheckboxComponent,
    UiToggleComponent,
    UiBadgeComponent,
    UiProgressBarComponent,
    UiCardComponent,
    UiTableComponent,
    UiStatCardComponent,
  ],
  templateUrl: './demo.html',
  styleUrl: './demo.scss',
})
export class Demo {
  inputValue = '';
  selectValue = 'minio';
  checkboxChecked = true;
  checkboxUnchecked = false;
  toggleOn = true;
  toggleOff = false;
  loadingButton = true;

  selectOptions: SelectOption[] = [
    { value: 'minio', label: 'MinIO' },
    { value: 's3', label: 'AWS S3' },
    { value: 'azure', label: 'Azure Blob' },
  ];

  tableRows = [
    { name: 'backups-2024', objects: 1_204, size: '120 GB', status: 'active' },
    { name: 'media-assets', objects: 45_892, size: '2.3 TB', status: 'active' },
    { name: 'logs-archive', objects: 890, size: '48 GB', status: 'locked' },
    { name: 'temp-uploads', objects: 33, size: '1.2 GB', status: 'inactive' },
  ];
}
