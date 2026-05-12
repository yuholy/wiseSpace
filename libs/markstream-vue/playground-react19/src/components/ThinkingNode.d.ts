import type { NodeComponentProps } from 'markstream-react';
interface ThinkingNodeData {
    node: {
        type: 'thinking';
        content: string;
        loading?: boolean;
        attrs?: Array<{
            name: string;
            value: string | boolean;
        }>;
    };
}
export declare function ThinkingNode(props: NodeComponentProps<ThinkingNodeData['node']>): import("react/jsx-runtime").JSX.Element;
export default ThinkingNode;
//# sourceMappingURL=ThinkingNode.d.ts.map