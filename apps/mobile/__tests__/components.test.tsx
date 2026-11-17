import { fireEvent, render, screen } from '@testing-library/react-native';
import { Inbox } from 'lucide-react-native';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  ProgressBar,
  Segmented,
  Skeleton,
} from '@/components/ui';

describe('ui components', () => {
  it('Button calls onPress and is inert while loading', async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<Button label="Save" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);

    await rerender(<Button label="Save" onPress={onPress} loading />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('EmptyState shows copy and runs its action', async () => {
    const onAction = jest.fn();
    await render(
      <EmptyState
        icon={Inbox}
        title="No downloads yet"
        description="Paste a link."
        actionLabel="Paste"
        onAction={onAction}
      />,
    );
    expect(screen.getByText('No downloads yet')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Paste' }));
    expect(onAction).toHaveBeenCalled();
  });

  it('ErrorState offers a retry', async () => {
    const onRetry = jest.fn();
    await render(
      <ErrorState title="Link failed" message="Check your connection." onRetry={onRetry} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('Segmented reports the chosen value', async () => {
    const onChange = jest.fn();
    await render(
      <Segmented
        options={[
          { value: 'a', label: 'Active' },
          { value: 'b', label: 'Completed' },
        ]}
        value="a"
        onChange={onChange}
      />,
    );
    await fireEvent.press(screen.getByText('Completed'));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('Chip exposes selected state and ProgressBar clamps its value', async () => {
    await render(
      <>
        <Chip label="Videos" selected />
        <ProgressBar value={4} />
        <Skeleton />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Videos' })).toBeTruthy();
    expect(screen.getByRole('progressbar').props.accessibilityValue.now).toBe(100);
  });
});
