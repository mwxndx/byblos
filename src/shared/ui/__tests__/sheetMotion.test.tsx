import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../sheet';
import fs from 'node:fs';
import path from 'node:path';

describe('Profile Sheet Slide Motion & Animation Configuration', () => {
  it('does not contain invalid duration tokens that fail Tailwind compilation', () => {
    const sheetFilePath = path.resolve(__dirname, '../sheet.tsx');
    const sheetSource = fs.readFileSync(sheetFilePath, 'utf-8');

    // duration-280 is not a valid Tailwind CSS class (must be duration-300)
    expect(sheetSource).not.toContain('duration-280');
  });

  it('renders SheetContent with a valid, non-default animation duration class', () => {
    render(
      <Sheet open={true}>
        <SheetContent side="right">
          <SheetHeader className="sr-only">
            <SheetTitle>Profile Settings</SheetTitle>
            <SheetDescription>View and manage profile settings</SheetDescription>
          </SheetHeader>
          <div>Profile content</div>
        </SheetContent>
      </Sheet>
    );

    // The dialog content element in portal
    const content = document.querySelector('[data-state="open"]');
    expect(content).not.toBeNull();
    const classList = content?.className || '';

    // Must not have invalid token
    expect(classList).not.toContain('duration-280');

    // Must have a valid duration token for opening (duration-300)
    expect(classList).toContain('data-[state=open]:duration-300');
  });
});
